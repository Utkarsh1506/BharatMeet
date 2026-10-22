import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { webPushConfigured, webPushPublicKey } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((value) => {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const approvedPushService = host === "fcm.googleapis.com" ||
      host === "web.push.apple.com" ||
      host === "push.services.mozilla.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com");
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && approvedPushService;
  }, "Use a supported browser push service endpoint"),
  keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(128) }).strict(),
}).strict();

export async function GET() {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));

    const subscriptions = await db.pushSubscription.findMany({ where: { profileId: profile.id }, select: { endpoint: true } });
    return NextResponse.json({
      configured: webPushConfigured,
      publicKey: webPushConfigured ? webPushPublicKey : null,
      subscribed: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
    }, { headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));
    if (!webPushConfigured) return NextResponse.json({ error: "Push notifications are not configured on this deployment." }, { status: 503 });

    const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    const { endpoint, keys } = parsed.data;
    const existing = await db.pushSubscription.findUnique({ where: { endpoint }, select: { profileId: true } });
    if (existing && existing.profileId !== profile.id) return ApiErrors.forbidden("This push subscription belongs to another account.");
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { profileId: profile.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { p256dh: keys.p256dh, auth: keys.auth },
    });
    return NextResponse.json({ success: true }, { status: 201, headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));
    const parsed = z.object({ endpoint: z.string().url().max(2048) }).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid endpoint." }, { status: 400 });
    await db.pushSubscription.deleteMany({ where: { profileId: profile.id, endpoint: parsed.data.endpoint } });
    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}
