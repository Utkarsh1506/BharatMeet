import { NextResponse } from "next/server";
import { ChannelType, MemberRole } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { z } from "zod";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeName } from "@/lib/sanitize";
import { uuidSchema } from "@/lib/query-validation";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const updateChannelSchema = z.object({
  name: z.string().trim().min(1).max(80).transform(sanitizeName).pipe(z.string().min(1).max(80)),
  type: z.nativeEnum(ChannelType),
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  try {
    const profile = await currentProfile();
    const { searchParams } = new URL(req.url);

    const serverId = searchParams.get("serverId");

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const parsedServerId = uuidSchema.safeParse(serverId);
    const parsedChannelId = uuidSchema.safeParse(channelId);
    if (!parsedServerId.success || !parsedChannelId.success) return ApiErrors.badRequest("Invalid workspace or room ID");

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const channel = await db.channel.findFirst({
      where: {
        id: parsedChannelId.data,
        serverId: parsedServerId.data,
        server: { members: { some: { profileId: profile.id, role: { in: [MemberRole.ADMIN, MemberRole.MODERATOR] } } } },
      },
      select: { id: true, name: true },
    });
    if (!channel) return ApiErrors.notFound("Room not found");
    if (channel.name.toLowerCase() === "general") return ApiErrors.badRequest("The general room cannot be deleted");

    const server = await db.server.update({
      where: {
        id: parsedServerId.data,
        members: {
          some: {
            profileId: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR],
            },
          },
        },
      },
      data: {
        channels: {
          delete: {
            id: parsedChannelId.data,
          },
        },
      },
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to delete room");
    return handleApiError(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  try {
    const profile = await currentProfile();
    const { searchParams } = new URL(req.url);

    const serverId = searchParams.get("serverId");

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const parsedServerId = uuidSchema.safeParse(serverId);
    const parsedChannelId = uuidSchema.safeParse(channelId);
    if (!parsedServerId.success || !parsedChannelId.success) return ApiErrors.badRequest("Invalid workspace or room ID");

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const body = await req.json().catch(() => null);
    const result = updateChannelSchema.safeParse(body);
    if (!result.success) return handleApiError(result.error);

    if (result.data.name.toLowerCase() === "general") {
      return ApiErrors.badRequest("Name cannot be 'general'");
    }

    const channel = await db.channel.findFirst({
      where: {
        id: parsedChannelId.data,
        serverId: parsedServerId.data,
        server: { members: { some: { profileId: profile.id, role: { in: [MemberRole.ADMIN, MemberRole.MODERATOR] } } } },
      },
      select: { id: true, name: true },
    });
    if (!channel) return ApiErrors.notFound("Room not found");
    if (channel.name.toLowerCase() === "general") return ApiErrors.badRequest("The general room cannot be changed");

    const server = await db.server.update({
      where: {
        id: parsedServerId.data,
        members: {
          some: {
            profileId: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR],
            },
          },
        },
      },
      data: {
        channels: {
          update: {
            where: {
              id: parsedChannelId.data,
            },
            data: {
              name: result.data.name,
              type: result.data.type,
            },
          },
        },
      },
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update room");
    return handleApiError(error);
  }
}
