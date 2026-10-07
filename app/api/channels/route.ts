import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { ChannelType } from "@prisma/client";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeName } from "@/lib/sanitize";
import { apiLogger } from "@/lib/logger";

const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Channel name is required.")
    .max(80)
    .transform((val) => sanitizeName(val)),
  type: z.nativeEnum(ChannelType),
});

export async function POST(
  req: Request
) {
  let serverId: string | null = null;

  try {
    const profile = await currentProfile();
    const body = await req.json();
    const { searchParams } = new URL(req.url);

    serverId = searchParams.get("serverId");

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      );
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
    apiLogger.error({ error, serverId }, "Failed to create channel");
    return new NextResponse("Internal Error", { status: 500 });
  }
}