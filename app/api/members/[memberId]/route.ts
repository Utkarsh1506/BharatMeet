import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { z } from "zod";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/query-validation";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const memberRoleSchema = z.object({
  role: z.enum(["GUEST", "MODERATOR"]),
});

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  try {
    const profile = await currentProfile();
    const { searchParams } = new URL(req.url);

    const serverId = searchParams.get("serverId");

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const parsedServerId = uuidSchema.safeParse(serverId);
    const parsedMemberId = uuidSchema.safeParse(memberId);
    if (!parsedServerId.success || !parsedMemberId.success) return ApiErrors.badRequest("Invalid workspace or member ID");

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const target = await db.member.findFirst({
      where: { id: parsedMemberId.data, serverId: parsedServerId.data, profileId: { not: profile.id } },
      select: { id: true },
    });
    if (!target) return ApiErrors.notFound("Member not found");

    const server = await db.server.update({
      where: { id: parsedServerId.data, profileId: profile.id },
      data: {
        members: {
          deleteMany: {
            id: parsedMemberId.data,
            profileId: {
              not: profile.id
            }
          }
        }
      },
      include: {
        members: {
          include: {
            profile: { select: { id: true, name: true, imageUrl: true, presenceStatus: true } },
          },
          orderBy: {
            role: "asc",
          }
        },
      },
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to remove workspace member");
    return handleApiError(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  try {
    const profile = await currentProfile();
    const { searchParams } = new URL(req.url);

    const serverId = searchParams.get("serverId");

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const parsedServerId = uuidSchema.safeParse(serverId);
    const parsedMemberId = uuidSchema.safeParse(memberId);
    if (!parsedServerId.success || !parsedMemberId.success) return ApiErrors.badRequest("Invalid workspace or member ID");

    const body = await req.json().catch(() => null);
    const result = memberRoleSchema.safeParse(body);
    if (!result.success) return handleApiError(result.error);

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const target = await db.member.findFirst({
      where: { id: parsedMemberId.data, serverId: parsedServerId.data, profileId: { not: profile.id } },
      select: { id: true },
    });
    if (!target) return ApiErrors.notFound("Member not found");

    const server = await db.server.update({
      where: { id: parsedServerId.data, profileId: profile.id },
      data: {
        members: {
          update: {
            where: {
              id: parsedMemberId.data,
              profileId: {
                not: profile.id
              }
            },
            data: { role: result.data.role }
          }
        }
      },
      include: {
        members: {
          include: {
            profile: { select: { id: true, name: true, imageUrl: true, presenceStatus: true } },
          },
          orderBy: {
            role: "asc"
          }
        }
      }
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update workspace member role");
    return handleApiError(error);
  }
}
