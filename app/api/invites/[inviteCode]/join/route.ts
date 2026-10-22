import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/query-validation";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode: rawInviteCode } = await params;
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();

    const inviteCode = uuidSchema.safeParse(rawInviteCode);
    if (!inviteCode.success) return ApiErrors.notFound("Invite link not found");

    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) {
      return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(rateLimit));
    }

    const serverId = await db.$transaction(async (transaction) => {
      // Serialize accepts for this invite so repeated or concurrent clicks
      // cannot create duplicate membership records.
      const invite = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Server" WHERE "inviteCode" = ${inviteCode.data} FOR UPDATE
      `;
      const server = invite[0];
      if (!server) return null;

      const existingMember = await transaction.member.findFirst({
        where: { serverId: server.id, profileId: profile.id },
        select: { id: true },
      });

      if (!existingMember) {
        await transaction.member.create({
          data: { serverId: server.id, profileId: profile.id },
        });
      }

      return server.id;
    });

    if (!serverId) return ApiErrors.notFound("Invite link not found");
    return NextResponse.json({ serverId }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to accept workspace invite");
    return handleApiError(error);
  }
}
