import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";

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
    console.log("[NOTIFICATIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
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

    const body = await req.json().catch(() => ({}));

    if (typeof body.notificationId === "string") {
      await db.notification.updateMany({
        where: {
          id: body.notificationId,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("[NOTIFICATIONS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
