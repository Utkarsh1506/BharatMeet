import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/query-validation";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { serverId: string } }
) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const id = uuidSchema.safeParse(params.serverId);
    if (!id.success) return ApiErrors.badRequest("Invalid workspace ID");

    const limit = await checkRateLimit(apiLimiter, profile.id);
    if (!limit.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(limit));

    const server = await db.server.update({
      where: {
        id: id.data,
        profileId: {
          not: profile.id
        },
        members: {
          some: {
            profileId: profile.id
          }
        }
      },
      data: {
        members: {
          deleteMany: {
            profileId: profile.id
          }
        }
      }
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to leave workspace");
    return handleApiError(error);
  }
}
