import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { ChannelType } from "@prisma/client";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

const channelSchema = z.object({
  name: z.string().trim().min(1, "Channel name is required.").max(80),
  type: z.nativeEnum(ChannelType),
});

export async function POST(
  req: Request
) {
  try {
    const profile = await currentProfile();
    const body = await req.json();
    const { searchParams } = new URL(req.url);

    const serverId = searchParams.get("serverId");

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!serverId) {
      return new NextResponse("Server ID missing", { status: 400 });
    }

    const result = channelSchema.safeParse(body);

    if (!result.success) {
      return new NextResponse(result.error.issues[0]?.message || "Invalid channel data", {
        status: 400,
      });
    }

    if (result.data.name.toLowerCase() === "general") {
      return new NextResponse("Name cannot be 'general'", { status: 400 });
    }

    const server = await db.server.update({
      where: {
        id: serverId,
        members: {
          some: {
            profileId: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR]
            }
          }
        }
      },
      data: {
        channels: {
          create: {
            profileId: profile.id,
            name: result.data.name,
            type: result.data.type,
          }
        }
      }
    });

    return NextResponse.json(server);
  } catch (error) {
    console.log("CHANNELS_POST", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
