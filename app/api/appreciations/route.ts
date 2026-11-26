import type { PushSubscription as WebPushSubscription } from "web-push";
import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { apiLimiter, checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { apiLogger } from "@/lib/logger";
import { sendWebPush, webPushConfigured } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const serverIdSchema = z.string().uuid();
const createSchema = z.object({
  serverId: z.string().uuid(),
  channelId: z.string().uuid(),
  recipientProfileId: z.string().uuid(),
  message: z.string().trim().min(3).max(300),
}).strict();

export async function GET(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));
    const serverId = serverIdSchema.safeParse(new URL(request.url).searchParams.get("serverId"));
    if (!serverId.success) return ApiErrors.badRequest("A valid workspace ID is required.");

    const member = await db.member.findFirst({ where: { serverId: serverId.data, profileId: profile.id }, select: { id: true } });
    if (!member) return ApiErrors.notFound("Workspace not found.");
    const appreciations = await db.appreciation.findMany({
      where: { serverId: serverId.data, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        message: true,
        createdAt: true,
        channel: { select: { id: true, name: true } },
        sender: { select: { id: true, name: true, imageUrl: true } },
        recipient: { select: { id: true, name: true, imageUrl: true } },
      },
    });
    return NextResponse.json({ appreciations }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    apiLogger.error({ err: error }, "Failed to load team appreciations");
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0]?.message || "Invalid appreciation.");
    const input = parsed.data;
    if (input.recipientProfileId === profile.id) return ApiErrors.badRequest("Choose a teammate to appreciate.");

    const [channel, recipientMember] = await Promise.all([
      db.channel.findFirst({
        where: { id: input.channelId, serverId: input.serverId, type: "TEXT", server: { members: { some: { profileId: profile.id } } } },
        select: { id: true, serverId: true },
      }),
      db.member.findFirst({ where: { serverId: input.serverId, profileId: input.recipientProfileId }, select: { id: true } }),
    ]);
    if (!channel) return ApiErrors.notFound("Room not found.");
    if (!recipientMember) return ApiErrors.badRequest("The teammate must belong to this workspace.");

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const sentToday = await db.appreciation.count({ where: { senderProfileId: profile.id, createdAt: { gte: dayStart } } });
    if (sentToday >= 5) return ApiErrors.rateLimitExceeded("You’ve sent today’s five appreciation notes. Save another for tomorrow.");

    const roomLink = `/servers/${channel.serverId}/channels/${channel.id}`;
    const appreciation = await db.$transaction(async (tx) => {
      const created = await tx.appreciation.create({
        data: {
          serverId: channel.serverId,
          channelId: channel.id,
          senderProfileId: profile.id,
          recipientProfileId: input.recipientProfileId,
          message: input.message,
        },
        select: { id: true, message: true, createdAt: true },
      });
      await tx.notification.create({
        data: {
          profileId: input.recipientProfileId,
          title: "A teammate appreciates you",
          content: `${profile.name}: ${input.message}`,
          link: roomLink,
        },
      });
      return created;
    });

    if (webPushConfigured) {
      try {
        const subscriptions = await db.pushSubscription.findMany({ where: { profileId: input.recipientProfileId } });
        const results = await Promise.allSettled(subscriptions.map((subscription) => sendWebPush({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        } as WebPushSubscription, {
          title: "A teammate appreciates you",
          body: `${profile.name}: ${input.message}`,
          url: roomLink,
          tag: `appreciation-${appreciation.id}`,
        })));
        const expired = results.flatMap((result, index) => result.status === "rejected" && [404, 410].includes(result.reason?.statusCode)
          ? [subscriptions[index].endpoint]
          : []);
        if (expired.length) await db.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
        results.forEach((result) => {
          if (result.status === "rejected" && ![404, 410].includes(result.reason?.statusCode)) {
            apiLogger.warn({ statusCode: result.reason?.statusCode, appreciationId: appreciation.id }, "Appreciation push delivery failed");
          }
        });
      } catch (pushError) {
        apiLogger.warn({ err: pushError, appreciationId: appreciation.id }, "Appreciation saved, but push delivery could not be checked");
      }
    }

    return NextResponse.json({ appreciation }, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    apiLogger.error({ err: error }, "Failed to send appreciation");
    return handleApiError(error);
  }
}
