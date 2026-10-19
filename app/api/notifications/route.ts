import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { apiLogger } from "@/lib/logger";

const notificationUpdateSchema = z.union([
  z.object({ notificationId: z.string().uuid() }).strict(),
  z.object({ markAllAsRead: z.literal(true) }).strict(),
]);

export async function GET() {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimitResult.success) {
      return ApiErrors.rateLimitExceeded(
        "Too many requests. Please slow down.",
        getRateLimitHeaders(rateLimitResult)
      );
    }

    const notifications = await db.notification.findMany({
      where: {
        profileId: profile.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return NextResponse.json(notifications, {
      headers: getRateLimitHeaders(rateLimitResult)
    });
  } catch (error) {
    apiLogger.error({ error }, "Failed to fetch notifications");
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimitResult.success) {
      return ApiErrors.rateLimitExceeded(
        "Too many requests. Please slow down.",
        getRateLimitHeaders(rateLimitResult)
      );
    }

    const body = await req.json().catch(() => null);
    const validation = notificationUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Provide a valid notificationId or markAllAsRead: true" }, { status: 400 });
    }

    if ("notificationId" in validation.data) {
      await db.notification.updateMany({
        where: {
          id: validation.data.notificationId,
          profileId: profile.id,
        },
        data: {
          read: true,
        },
      });

      return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rateLimitResult) });
    }

    await db.notification.updateMany({
      where: {
        profileId: profile.id,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rateLimitResult) });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update notifications");
    return handleApiError(error);
  }
}
