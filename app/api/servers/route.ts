import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { checkRateLimit, serverCreationLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeFileUrl, sanitizeName } from "@/lib/sanitize";
import { apiLogger } from "@/lib/logger";
import { ApiErrors, handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const serverSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Server name must be at least 2 characters.")
    .max(80)
    .transform((val) => sanitizeName(val))
    .pipe(z.string().min(2).max(80)),
  imageUrl: z
    .string()
    .url("A valid server image is required.")
    .max(2048)
    .refine((value) => sanitizeFileUrl(value) !== null, "Use an image uploaded through UploadThing"),
});

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

    // Apply rate limiting for server creation
    const rateLimitResult = await checkRateLimit(serverCreationLimiter, profile.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many servers created. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      );
    }

    const body = await req.json().catch(() => null);
    const result = serverSchema.safeParse(body);

    if (!result.success) {
      return handleApiError(result.error);
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
