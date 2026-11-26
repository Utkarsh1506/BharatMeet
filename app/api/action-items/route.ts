import { ActionItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { apiLimiter, checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { apiLogger } from "@/lib/logger";
import { reminderSchedulerConfigured, scheduleReminderDelivery } from "@/lib/reminder-scheduler";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

export async function GET(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();

    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));

    const serverId = uuid.safeParse(new URL(request.url).searchParams.get("serverId"));
    if (!serverId.success) return ApiErrors.badRequest("A valid workspace ID is required.");

    const membership = await db.member.findFirst({
      where: { serverId: serverId.data, profileId: profile.id },
      select: { id: true },
    });
    if (!membership) return ApiErrors.notFound("Workspace not found.");

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [structuredPulses, legacyPulses, actionItems] = await Promise.all([
      db.teamPulse.findMany({
        where: { serverId: serverId.data, pulseDate: { gte: since } },
        orderBy: [{ pulseDate: "desc" }, { updatedAt: "desc" }],
        take: 30,
        select: {
          id: true,
          done: true,
          next: true,
          blocked: true,
          pulseDate: true,
          createdAt: true,
          updatedAt: true,
          channel: { select: { id: true, name: true } },
          profile: { select: { id: true, name: true, imageUrl: true } },
          actionItems: { select: { id: true, title: true, status: true } },
        },
      }),
      db.message.findMany({
        where: {
          channel: { serverId: serverId.data, type: "TEXT" },
          deleted: false,
          content: { startsWith: "TEAM PULSE ·" },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          content: true,
          createdAt: true,
          channel: { select: { id: true, name: true } },
          member: { select: { profile: { select: { id: true, name: true, imageUrl: true } } } },
          actionItems: { select: { id: true, title: true, status: true } },
        },
      }),
      db.actionItem.findMany({
        where: { serverId: serverId.data, status: { not: ActionItemStatus.DONE } },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          createdAt: true,
          channel: { select: { id: true, name: true } },
          sourceMessageId: true,
          sourcePulseId: true,
          assignee: { select: { id: true, name: true } },
        },
      }),
    ]);

    const pulses = [
      ...structuredPulses.map((pulse) => ({
        id: pulse.id,
        pulseId: pulse.id,
        content: [
          `TEAM PULSE · ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(pulse.pulseDate)}`,
          `✅ Done: ${pulse.done || "—"}`,
          `🎯 Next: ${pulse.next || "—"}`,
          `🧱 Blocked: ${pulse.blocked || "None"}`,
        ].join("\n"),
        createdAt: pulse.updatedAt,
        channel: pulse.channel,
        member: { profile: pulse.profile },
        actionItems: pulse.actionItems,
      })),
      ...legacyPulses.map((pulse) => ({ ...pulse, pulseId: null })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);

    return NextResponse.json({ pulses, actionItems, currentProfileId: profile.id }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    apiLogger.error({ err: error }, "Failed to load workspace catch-up");
    return handleApiError(error);
  }
}

const createActionSchema = z.object({
  serverId: uuid,
  channelId: uuid,
  sourceMessageId: uuid.nullable().optional(),
  sourcePulseId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(240),
  assigneeProfileId: uuid.nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));

    const parsed = createActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0]?.message || "Invalid action item.");
    const input = parsed.data;
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (dueAt && dueAt.getTime() <= Date.now()) return ApiErrors.badRequest("Choose a future due date.");

    const [channel, assignee] = await Promise.all([
      db.channel.findFirst({
        where: { id: input.channelId, serverId: input.serverId, server: { members: { some: { profileId: profile.id } } } },
        select: { id: true, name: true, serverId: true },
      }),
      input.assigneeProfileId
        ? db.member.findFirst({ where: { serverId: input.serverId, profileId: input.assigneeProfileId }, select: { profileId: true } })
        : Promise.resolve(null),
    ]);
    if (!channel) return ApiErrors.notFound("Room not found.");
    if (input.assigneeProfileId && !assignee) return ApiErrors.badRequest("The selected owner is not in this workspace.");

    if (input.sourceMessageId) {
      const sourceMessage = await db.message.findFirst({
        where: { id: input.sourceMessageId, channelId: channel.id, deleted: false },
        select: { id: true },
      });
      if (!sourceMessage) return ApiErrors.badRequest("The source update must belong to this room.");
    }

    if (input.sourcePulseId) {
      const sourcePulse = await db.teamPulse.findFirst({
        where: { id: input.sourcePulseId, serverId: channel.serverId, channelId: channel.id },
        select: { id: true },
      });
      if (!sourcePulse) return ApiErrors.badRequest("The source pulse must belong to this room.");
    }

    const destinationProfileId = input.assigneeProfileId || profile.id;
    const roomLink = `/servers/${channel.serverId}/channels/${channel.id}`;
    const created = await db.$transaction(async (tx) => {
      const reminder = dueAt
        ? await tx.reminder.create({
            data: {
              profileId: destinationProfileId,
              title: `Action due: ${input.title}`.slice(0, 160),
              dueAt,
              link: roomLink,
            },
            select: { id: true },
          })
        : null;

      const actionItem = await tx.actionItem.create({
        data: {
          serverId: channel.serverId,
          channelId: channel.id,
          sourceMessageId: input.sourceMessageId || null,
          sourcePulseId: input.sourcePulseId || null,
          createdByProfileId: profile.id,
          assigneeProfileId: destinationProfileId,
          reminderId: reminder?.id,
          title: input.title,
          dueAt,
        },
        select: { id: true, title: true, dueAt: true, assigneeProfileId: true, reminderId: true },
      });

      if (destinationProfileId !== profile.id) {
        await tx.notification.create({
          data: {
            profileId: destinationProfileId,
            title: "You have a new follow-up",
            content: `${profile.name} assigned you: ${input.title}`,
            link: roomLink,
          },
        });
      }
      return actionItem;
    });

    if (created.reminderId && dueAt && reminderSchedulerConfigured) {
      try {
        await scheduleReminderDelivery(created.reminderId, dueAt);
      } catch (error) {
        // Keep the action item; foreground reminder delivery remains available when the app is open.
        apiLogger.warn({ err: error, actionItemId: created.id }, "Could not schedule action reminder in the background");
      }
    }

    return NextResponse.json({ actionItem: created }, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    apiLogger.error({ err: error }, "Failed to create action item");
    return handleApiError(error);
  }
}

const updateActionSchema = z.object({
  serverId: uuid,
  actionItemId: uuid,
  status: z.nativeEnum(ActionItemStatus),
}).strict();

export async function PATCH(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));

    const parsed = updateActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return ApiErrors.badRequest("Invalid action item update.");
    const member = await db.member.findFirst({ where: { serverId: parsed.data.serverId, profileId: profile.id }, select: { id: true } });
    if (!member) return ApiErrors.notFound("Workspace not found.");

    const actionItem = await db.actionItem.findFirst({
      where: { id: parsed.data.actionItemId, serverId: parsed.data.serverId },
      select: { id: true, reminderId: true },
    });
    if (!actionItem) return ApiErrors.notFound("Action item not found.");
    const completedAt = parsed.data.status === ActionItemStatus.DONE ? new Date() : null;
    await db.$transaction([
      db.actionItem.update({ where: { id: actionItem.id }, data: { status: parsed.data.status, completedAt } }),
      ...(completedAt && actionItem.reminderId
        ? [db.reminder.updateMany({ where: { id: actionItem.reminderId, completedAt: null }, data: { completedAt } })]
        : []),
    ]);
    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    apiLogger.error({ err: error }, "Failed to update action item");
    return handleApiError(error);
  }
}
