import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendWebPush, webPushConfigured } from "@/lib/web-push";
import { scheduleReminderDelivery } from "@/lib/reminder-scheduler";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function deliverReminder(request: Request) {
  const input = z.object({ reminderId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid reminder" }, { status: 400 });

  const reminder = await db.reminder.findUnique({ where: { id: input.data.reminderId } });
  if (!reminder || reminder.completedAt || reminder.sentAt) return NextResponse.json({ success: true, skipped: true });

  // QStash free delayed messages are limited to seven days. Requeue in chunks
  // so long-range reminders still fire at their intended time.
  if (reminder.dueAt.getTime() > Date.now()) {
    await scheduleReminderDelivery(reminder.id, reminder.dueAt);
    return NextResponse.json({ success: true, rescheduled: true });
  }

  const created = await db.$transaction(async (tx) => {
    const claim = await tx.reminder.updateMany({
      where: { id: reminder.id, sentAt: null, completedAt: null, dueAt: { lte: new Date() } },
      data: { sentAt: new Date() },
    });
    if (claim.count === 0) return false;
    await tx.notification.create({
      data: { profileId: reminder.profileId, title: "Reminder", content: reminder.title, link: reminder.link },
    });
    return true;
  });
  if (!created) return NextResponse.json({ success: true, skipped: true });

  const subscriptions = await db.pushSubscription.findMany({ where: { profileId: reminder.profileId } });
  if (webPushConfigured) {
    const outcomes = await Promise.allSettled(subscriptions.map((subscription) => sendWebPush({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    } as WebPushSubscription, {
      title: "Bharat Meet reminder",
      body: reminder.title,
      url: reminder.link,
      tag: `reminder-${reminder.id}`,
    })));
    const expiredEndpoints = outcomes.flatMap((outcome, index) => {
      if (outcome.status === "rejected" && outcome.reason && (outcome.reason.statusCode === 404 || outcome.reason.statusCode === 410)) return [subscriptions[index].endpoint];
      if (outcome.status === "rejected") apiLogger.warn({ statusCode: outcome.reason?.statusCode }, "Push notification delivery failed");
      return [];
    });
    if (expiredEndpoints.length) await db.pushSubscription.deleteMany({ where: { endpoint: { in: expiredEndpoints } } });
  }
  return NextResponse.json({ success: true, notified: true });
}

const hasQStashSigningKeys = Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);

export const POST = hasQStashSigningKeys
  ? verifySignatureAppRouter(deliverReminder, {
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      url: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://invalid.local"}/api/reminders/dispatch`,
    })
  : async () => NextResponse.json({ error: "Reminder delivery is not configured." }, { status: 503 });
