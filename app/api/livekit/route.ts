import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { ApiErrors } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");

  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
  }

  const profile = await currentProfile();

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

  const [channel, conversation] = await Promise.all([
    db.channel.findFirst({
      where: {
        id: room,
        server: { members: { some: { profileId: profile.id } } },
      },
      select: { id: true },
    }),
    db.conversation.findFirst({
      where: {
        id: room,
        OR: [
          { memberOne: { profileId: profile.id } },
          { memberTwo: { profileId: profile.id } },
        ],
      },
      select: { id: true },
    }),
  ]);

  if (!channel && !conversation) {
    return NextResponse.json({ error: "You do not have access to this meeting" }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const livekitHost = wsUrl.replace(/^ws/, "http");
  const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);

  try {
    const rooms = await roomService.listRooms([room]);

    if (rooms.length === 0) {
      await roomService.createRoom({
        name: room,
        emptyTimeout: 300,
      });
    }
  } catch (error) {
    apiLogger.error({ error, room }, "Failed to create LiveKit room");
    return NextResponse.json({ error: "Unable to create LiveKit room" }, { status: 502 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: profile.userId,
    name: profile.name,
  });

  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  return NextResponse.json({ token: at.toJwt() }, {
    headers: getRateLimitHeaders(rateLimitResult)
  });
}