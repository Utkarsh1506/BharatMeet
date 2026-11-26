import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { apiLimiter, checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  serverId: z.string().uuid(),
  channelId: z.string().uuid(),
  pulseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.string().trim().max(900).default(""),
  next: z.string().trim().max(900).default(""),
  blocked: z.string().trim().max(900).default(""),
}).strict().refine((value) => value.done || value.next || value.blocked, "Add at least one update before sharing your pulse.");

const querySchema = z.object({ serverId: z.string().uuid(), channelId: z.string().uuid(), pulseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

export async function GET(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return ApiErrors.badRequest("A valid workspace, room, and pulse date are required.");
    const pulseDate = new Date(`${parsed.data.pulseDate}T00:00:00.000Z`);
    if (Number.isNaN(pulseDate.getTime()) || pulseDate.toISOString().slice(0, 10) !== parsed.data.pulseDate) return ApiErrors.badRequest("Choose a valid pulse date.");
    const channel = await db.channel.findFirst({
      where: { id: parsed.data.channelId, serverId: parsed.data.serverId, type: "TEXT", server: { members: { some: { profileId: profile.id } } } },
      select: { id: true, serverId: true },
    });
    if (!channel) return ApiErrors.notFound("Room not found.");
    const pulse = await db.teamPulse.findUnique({
      where: { serverId_profileId_pulseDate: { serverId: channel.serverId, profileId: profile.id, pulseDate } },
      select: { id: true, done: true, next: true, blocked: true, updatedAt: true },
    });
    return NextResponse.json({ pulse }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0]?.message || "Invalid team pulse.");
    const input = parsed.data;
    const pulseDate = new Date(`${input.pulseDate}T00:00:00.000Z`);
    if (Number.isNaN(pulseDate.getTime()) || pulseDate.toISOString().slice(0, 10) !== input.pulseDate) {
      return ApiErrors.badRequest("Choose a valid pulse date.");
    }
    // Allow local dates one day either side of UTC to support teams across time zones,
    // while preventing users from creating arbitrary historical or future updates.
    const utcToday = new Date();
    utcToday.setUTCHours(0, 0, 0, 0);
    const dayDelta = (pulseDate.getTime() - utcToday.getTime()) / 86_400_000;
    if (dayDelta < -1 || dayDelta > 1) return ApiErrors.badRequest("Pulse date must be today in your local time zone.");

    const channel = await db.channel.findFirst({
      where: {
        id: input.channelId,
        serverId: input.serverId,
        type: "TEXT",
        server: { members: { some: { profileId: profile.id } } },
      },
      select: { id: true, serverId: true },
    });
    if (!channel) return ApiErrors.notFound("Room not found.");

    const pulse = await db.teamPulse.upsert({
      where: { serverId_profileId_pulseDate: { serverId: channel.serverId, profileId: profile.id, pulseDate } },
      create: {
        serverId: channel.serverId,
        channelId: channel.id,
        profileId: profile.id,
        pulseDate,
        done: input.done,
        next: input.next,
        blocked: input.blocked,
      },
      update: {
        channelId: channel.id,
        done: input.done,
        next: input.next,
        blocked: input.blocked,
      },
      select: { id: true, pulseDate: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ pulse }, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleApiError(error);
  }
}
