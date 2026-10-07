import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const profile = await currentProfile();
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");
  const query = searchParams.get("q")?.trim();

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

  if (!serverId || !query || query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  if (query.length > 100) {
    return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
  }

  const server = await db.server.findFirst({
    where: {
      id: serverId,
      members: { some: { profileId: profile.id } },
    },
    select: { id: true },
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const messages = await db.message.findMany({
    where: {
      deleted: false,
      content: { contains: query, mode: "insensitive" },
      channel: {
        serverId,
        type: "TEXT",
      },
    },
    include: {
      channel: { select: { id: true, name: true } },
      member: { include: { profile: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    items: messages.map((message) => ({
      id: message.id,
      channelId: message.channel.id,
      name: `${message.member.profile.name} in #${message.channel.name}: ${message.content}`,
    })),
  }, {
    headers: getRateLimitHeaders(rateLimitResult)
  });
}
