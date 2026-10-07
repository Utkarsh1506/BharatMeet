import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { checkRateLimit, serverCreationLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeName, sanitizeUrl } from "@/lib/sanitize";
import { apiLogger } from "@/lib/logger";

const serverSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Server name must be at least 2 characters.")
    .max(80)
    .transform((val) => sanitizeName(val)),
  imageUrl: z
    .string()
    .url("A valid server image is required.")
    .max(2048)
    .transform((val) => sanitizeUrl(val)),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profile = await currentProfile();

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
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

    const result = serverSchema.safeParse(body);

    if (!result.success) {
      return new NextResponse(result.error.issues[0]?.message || "Invalid server data", {
        status: 400,
      });
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

    return NextResponse.json(server);
  } catch (error) {
    apiLogger.error({ error }, "Failed to create server");
    return new NextResponse("Internal Error", { status: 500 });
  }
}