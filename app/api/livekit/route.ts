import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const username = req.nextUrl.searchParams.get("username");
  const name = req.nextUrl.searchParams.get("name") || undefined;
  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
  } else if (!username) {
    return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
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
    console.error("LIVEKIT_ROOM_SETUP", error);
    return NextResponse.json({ error: "Unable to create LiveKit room" }, { status: 502 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    name,
  });

  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  return NextResponse.json({ token: at.toJwt() });
}