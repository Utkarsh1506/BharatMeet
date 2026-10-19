import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/query-validation";
import { apiLogger } from "@/lib/logger";

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
        profileId: profile.id,
      },
      data: {
        inviteCode: uuidv4(),
      },
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(limit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to rotate workspace invite code");
    return handleApiError(error);
  }
}
