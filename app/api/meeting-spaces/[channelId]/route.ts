import { MeetingMode, ChannelType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { apiLimiter, checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { uuidSchema } from "@/lib/query-validation";

export const dynamic = "force-dynamic";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mode"), mode: z.nativeEnum(MeetingMode) }),
  z.object({ action: z.literal("agenda-add"), title: z.string().trim().min(2).max(180) }),
  z.object({ action: z.literal("agenda-toggle"), id: uuidSchema }),
  z.object({ action: z.literal("decision-add"), summary: z.string().trim().min(3).max(500) }),
  z.object({
    action: z.literal("task-add"),
    title: z.string().trim().min(2).max(240),
    assigneeProfileId: uuidSchema.nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  }),
  z.object({ action: z.literal("task-toggle"), id: uuidSchema }),
]);

const getAuthorizedContext = async (channelId: string) => {
  const profile = await currentProfile();
  if (!profile) return { error: ApiErrors.unauthorized() } as const;

  const parsedId = uuidSchema.safeParse(channelId);
  if (!parsedId.success) return { error: ApiErrors.badRequest("Invalid meeting room") } as const;

  const channel = await db.channel.findFirst({
    where: {
      id: parsedId.data,
      type: { in: [ChannelType.AUDIO, ChannelType.VIDEO] },
      server: { members: { some: { profileId: profile.id } } },
    },
    select: { id: true, serverId: true },
  });
  if (!channel) return { error: ApiErrors.notFound("Meeting room not found") } as const;

  const limit = await checkRateLimit(apiLimiter, profile.id);
  if (!limit.success) {
    return { error: ApiErrors.rateLimitExceeded("Too many meeting updates. Please slow down.", getRateLimitHeaders(limit)) } as const;
  }

  return { profile, channel, limit } as const;
};

const getWorkspace = (channelId: string) => db.meetingWorkspace.upsert({
  where: { channelId },
  create: { channelId },
  update: {},
  include: {
    agenda: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    decisions: {
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { author: { select: { id: true, name: true, imageUrl: true } } },
    },
    actions: {
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: { assignee: { select: { id: true, name: true, imageUrl: true } } },
    },
  },
});

export async function GET(_req: Request, { params }: { params: { channelId: string } }) {
  try {
    const context = await getAuthorizedContext(params.channelId);
    if ("error" in context) return context.error;
    const workspace = await getWorkspace(context.channel.id);
    return NextResponse.json(workspace, { headers: getRateLimitHeaders(context.limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to load meeting workspace");
    return handleApiError(error);
  }
}

export async function POST(req: Request, { params }: { params: { channelId: string } }) {
  try {
    const context = await getAuthorizedContext(params.channelId);
    if ("error" in context) return context.error;

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return ApiErrors.badRequest(parsed.error.issues[0]?.message || "Invalid meeting update");

    const data = parsed.data;
    const workspace = await getWorkspace(context.channel.id);

    switch (data.action) {
      case "mode":
        await db.meetingWorkspace.update({ where: { id: workspace.id }, data: { mode: data.mode } });
        break;
      case "agenda-add": {
        const last = await db.meetingAgendaItem.findFirst({ where: { workspaceId: workspace.id }, orderBy: { position: "desc" }, select: { position: true } });
        await db.meetingAgendaItem.create({ data: { workspaceId: workspace.id, title: data.title, position: (last?.position ?? -1) + 1 } });
        break;
      }
      case "agenda-toggle": {
        const item = await db.meetingAgendaItem.findFirst({ where: { id: data.id, workspaceId: workspace.id }, select: { id: true, completed: true } });
        if (!item) return ApiErrors.notFound("Agenda item not found");
        await db.meetingAgendaItem.update({ where: { id: item.id }, data: { completed: !item.completed } });
        break;
      }
      case "decision-add":
        await db.meetingDecision.create({ data: { workspaceId: workspace.id, authorProfileId: context.profile.id, summary: data.summary } });
        break;
      case "task-add": {
        if (data.assigneeProfileId) {
          const isMember = await db.member.findFirst({ where: { serverId: context.channel.serverId, profileId: data.assigneeProfileId }, select: { id: true } });
          if (!isMember) return ApiErrors.badRequest("The task owner must be a workspace member");
        }
        await db.meetingAction.create({
          data: {
            workspaceId: workspace.id,
            title: data.title,
            assigneeProfileId: data.assigneeProfileId ?? null,
            dueAt: data.dueAt ? new Date(data.dueAt) : null,
          },
        });
        break;
      }
      case "task-toggle": {
        const task = await db.meetingAction.findFirst({ where: { id: data.id, workspaceId: workspace.id }, select: { id: true, completed: true } });
        if (!task) return ApiErrors.notFound("Follow-up task not found");
        await db.meetingAction.update({ where: { id: task.id }, data: { completed: !task.completed } });
        break;
      }
    }

    const updated = await getWorkspace(context.channel.id);
    return NextResponse.json(updated, { headers: getRateLimitHeaders(context.limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update meeting workspace");
    return handleApiError(error);
  }
}
