import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { checkRateLimit, serverCreationLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { apiLogger } from "@/lib/logger";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { workspaceSchema } from "@/lib/workspace-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await currentProfile();

    if (!profile) {
    return ApiErrors.unauthorized();
    }

    const servers = await db.server.findMany({
      where: {
        members: {
          some: { profileId: profile.id },
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ servers });
  } catch (error) {
    apiLogger.error({ error }, "Failed to list workspaces");
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    const body = await req.json().catch(() => null);
    const result = workspaceSchema.safeParse(body);

    if (!result.success) {
      return handleApiError(result.error);
    }

    // Only validated requests count against the quota. Invalid forms and
    // incomplete image uploads must not consume workspace creation attempts.
    const rateLimitResult = await checkRateLimit(serverCreationLimiter, profile.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "You have reached the workspace creation limit. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      );
    }

    const server = await db.server.create({
      data: {
        profileId: profile.id,
        name: result.data.name,
        imageUrl: result.data.imageUrl,
        inviteCode: uuidv4(),
        channels: {
          create: [
            { name: "general", profileId: profile.id }
          ]
        },
        members: {
          create: [
            { profileId: profile.id, role: MemberRole.ADMIN }
          ]
        }
      }
    });

    return NextResponse.json(server, { headers: getRateLimitHeaders(rateLimitResult) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to create server");
    return handleApiError(error);
  }
}
