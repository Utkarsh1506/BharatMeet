import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { ChannelType } from "@prisma/client";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeName } from "@/lib/sanitize";
import { apiLogger } from "@/lib/logger";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { uuidSchema } from "@/lib/query-validation";
import { isDefaultChannelName } from "@/lib/channel-name";

export const dynamic = "force-dynamic";

const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Channel name is required.")
    .max(80)
    .transform((val) => sanitizeName(val))
    .pipe(z.string().min(1).max(80)),
  type: z.nativeEnum(ChannelType),
});

export async function POST(
  req: Request
) {
  let serverId: string | null = null;

  try {
    const profile = await currentProfile();
    const { searchParams } = new URL(req.url);

    serverId = searchParams.get("serverId");

    if (!profile) {
      return ApiErrors.unauthorized();
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
      return ApiErrors.badRequest("Server ID missing");
    }

    const parsedServerId = uuidSchema.safeParse(serverId);
    if (!parsedServerId.success) return ApiErrors.badRequest("Invalid workspace ID");

    const body = await req.json().catch(() => null);

    const result = channelSchema.safeParse(body);

    if (!result.success) {
      return handleApiError(result.error);
    }

    if (isDefaultChannelName(result.data.name)) {
      return ApiErrors.badRequest("This name is reserved for the default room.");
    }

    const server = await db.server.update({
      where: {
        id: parsedServerId.data,
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

    return NextResponse.json(server, { headers: getRateLimitHeaders(rateLimitResult) });
  } catch (error) {
    apiLogger.error({ error, serverId }, "Failed to create channel");
    return handleApiError(error);
  }
}
