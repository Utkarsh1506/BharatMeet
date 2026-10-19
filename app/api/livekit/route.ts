import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/query-validation";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");

  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
  }

  if (!uuidSchema.safeParse(room).success) {
    return NextResponse.json({ error: "Invalid meeting room" }, { status: 400 });
  }

  try {
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
        type: { in: ["AUDIO", "VIDEO"] },
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

  const protocol = new URL(wsUrl).protocol;
  if (protocol !== "ws:" && protocol !== "wss:") {
    return NextResponse.json({ error: "Meeting server URL must use ws:// or wss://" }, { status: 500 });
  }

  // This LiveKit deployment requires rooms to exist before participants join.
  // Provision on demand and keep the check idempotent for concurrent joiners.
  const roomService = new RoomServiceClient(wsUrl.replace(/^ws/, "http"), apiKey, apiSecret);
  try {
    const rooms = await roomService.listRooms([room]);
    if (rooms.length === 0) {
      try {
        await roomService.createRoom({ name: room, emptyTimeout: 300 });
      } catch (createError) {
        // Two participants may request a token at the same time. If the other
        // request created the room first, treat that as a successful provision.
        const roomsAfterRace = await roomService.listRooms([room]);
        if (!roomsAfterRace.some((existingRoom) => existingRoom.name === room)) {
          throw createError;
        }
      }
    }
  } catch (error) {
    apiLogger.error({ error, room }, "Failed to provision LiveKit room");
    return NextResponse.json({ error: "Unable to prepare the meeting room. Try again shortly." }, { status: 502 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: profile.userId,
    name: profile.name,
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: at.toJwt() }, {
    headers: {
      ...getRateLimitHeaders(rateLimitResult),
      "Cache-Control": "no-store, private",
    },
  });
  } catch (error) {
    apiLogger.error({ error, room }, "Failed to issue meeting token");
    return handleApiError(error);
  }
}
