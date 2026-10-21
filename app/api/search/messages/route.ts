import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { validateQueryParams, searchQuerySchema } from "@/lib/query-validation";
import { handleApiError } from "@/lib/api-error";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
  const profile = await currentProfile();
  const { searchParams } = new URL(req.url);

  if (!profile) {
    return ApiErrors.unauthorized();
  }

  // Apply rate limiting
  const rateLimitResult = await checkRateLimit(apiLimiter, profile.id);
  if (!rateLimitResult.success) {
    return ApiErrors.rateLimitExceeded(
      "Too many requests. Please slow down.",
      getRateLimitHeaders(rateLimitResult)
    );
  }

  const validation = validateQueryParams(searchQuerySchema, searchParams);
  if (!validation.success) {
    return handleApiError(validation.error);
  }

  const { serverId, channelId, memberId, from, to, limit, timezoneOffset } = validation.data;
  const query = validation.data.q;

  const dateBoundary = (value: string, endOfDay = false) => {
    const [year, month, day] = value.split("-").map(Number);
    const localDayStartAsUtc = Date.UTC(year, month - 1, day) + timezoneOffset * 60_000;
    return new Date(localDayStartAsUtc + (endOfDay ? 86_400_000 - 1 : 0));
  };

  if (query.length > 0 && query.length < 2) {
    return NextResponse.json({ items: [] }, { headers: getRateLimitHeaders(rateLimitResult) });
  }

  if (!query && !channelId && !memberId && !from && !to) {
    return NextResponse.json({ items: [] }, { headers: getRateLimitHeaders(rateLimitResult) });
  }

  const server = await db.server.findFirst({
    where: {
      id: serverId,
      members: { some: { profileId: profile.id } },
    },
    select: { id: true },
  });

  if (!server) {
    return ApiErrors.notFound("Workspace not found");
  }

  if (channelId) {
    const channel = await db.channel.findFirst({
      where: { id: channelId, serverId, type: "TEXT" },
      select: { id: true },
    });
    if (!channel) return ApiErrors.badRequest("Choose a text room in this workspace");
  }

  if (memberId) {
    const member = await db.member.findFirst({
      where: { id: memberId, serverId },
      select: { id: true },
    });
    if (!member) return ApiErrors.badRequest("Choose a person in this workspace");
  }

  const messages = await db.message.findMany({
    where: {
      deleted: false,
      ...(query ? { content: { contains: query, mode: "insensitive" as const } } : {}),
      ...(memberId ? { memberId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: dateBoundary(from) } : {}),
          ...(to ? { lte: dateBoundary(to, true) } : {}),
        },
      } : {}),
      channel: {
        serverId,
        type: "TEXT",
        ...(channelId ? { id: channelId } : {}),
      },
    },
    include: {
      channel: { select: { id: true, name: true } },
      member: { include: { profile: { select: { name: true, imageUrl: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    items: messages.map((message) => ({
      id: message.id,
      channelId: message.channel.id,
      channelName: message.channel.name,
      authorName: message.member.profile.name,
      authorImageUrl: message.member.profile.imageUrl,
      content: message.content,
      createdAt: message.createdAt,
    })),
  }, {
    headers: getRateLimitHeaders(rateLimitResult)
  });
  } catch (error) {
    apiLogger.error({ error }, "Failed to search workspace messages");
    return handleApiError(error);
  }
}
