import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { z } from "zod";
import { MemberRole } from "@prisma/client";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeFileUrl, sanitizeName } from "@/lib/sanitize";
import { uuidSchema } from "@/lib/query-validation";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const updateServerSchema = z.object({
  name: z.string().trim().max(160).transform(sanitizeName).pipe(z.string().min(2).max(80)),
  imageUrl: z.string().url().max(2048).refine((value) => sanitizeFileUrl(value) !== null, "Use an image uploaded through UploadThing"),
});

const parseServerId = (serverId: string) => uuidSchema.safeParse(serverId);

export async function GET(
  req: Request,
  { params }: { params: { serverId: string } }
) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const id = parseServerId(params.serverId);
    if (!id.success) return ApiErrors.badRequest("Invalid workspace ID");

    const server = await db.server.findFirst({
      where: {
        id: id.data,
        members: { some: { profileId: profile.id } },
      },
      include: {
        channels: { orderBy: { createdAt: "asc" } },
        members: {
          include: {
            profile: {
              select: { id: true, name: true, imageUrl: true, presenceStatus: true },
            },
          },
          orderBy: { role: "asc" },
        },
      },
    });

    if (!server) {
      return ApiErrors.notFound("Workspace not found");
    }

    const member = server.members.find((item) => item.profileId === profile.id);
    if (!member) {
      return ApiErrors.notFound("Workspace not found");
    }

    const { inviteCode, ...safeServer } = server;
    return NextResponse.json({
      server: {
        ...safeServer,
        ...(member.role === MemberRole.GUEST ? {} : { inviteCode }),
      },
      profile: {
        id: profile.id,
        name: profile.name,
        imageUrl: profile.imageUrl,
      },
      role: member.role,
    });
  } catch (error) {
    apiLogger.error({ error }, "Failed to fetch workspace");
    return handleApiError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { serverId: string } }
) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const id = parseServerId(params.serverId);
    if (!id.success) return ApiErrors.badRequest("Invalid workspace ID");

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const server = await db.server.delete({
      where: {
        id: id.data,
        profileId: profile.id,
      }
    });

    return NextResponse.json(server);
  } catch (error) {
    apiLogger.error({ error }, "Failed to delete workspace");
    return handleApiError(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { serverId: string } }
) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const id = parseServerId(params.serverId);
    if (!id.success) return ApiErrors.badRequest("Invalid workspace ID");

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const body = await req.json().catch(() => null);
    const result = updateServerSchema.safeParse(body);
    if (!result.success) return handleApiError(result.error);

    const server = await db.server.update({
      where: {
        id: id.data,
        profileId: profile.id,
      },
      data: {
        name: result.data.name,
        imageUrl: result.data.imageUrl,
      }
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update workspace");
    return handleApiError(error);
  }
}
