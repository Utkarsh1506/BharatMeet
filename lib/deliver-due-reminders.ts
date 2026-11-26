import type { PushSubscription as WebPushSubscription } from "web-push";

import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { sendWebPush, webPushConfigured } from "@/lib/web-push";

/**
 * Foreground fallback for deployments without QStash. NotificationsPanel polls
 * the authenticated notifications API, so due reminders are still delivered
 * while the app is open. The conditional update makes this safe to race with
 * QStash delivery and with other app tabs.
 */
export async function deliverDueReminders(profileId: string) {
  const dueReminders = await db.reminder.findMany({
    where: {
      profileId,
      sentAt: null,
      completedAt: null,
      dueAt: { lte: new Date() },
    },
    select: { id: true, profileId: true, title: true, link: true },
    orderBy: { dueAt: "asc" },
    take: 20,
  });

  await Promise.all(dueReminders.map(async (reminder) => {
    const claimed = await db.$transaction(async (tx) => {
      const result = await tx.reminder.updateMany({
        where: {
          id: reminder.id,
          profileId,
          sentAt: null,
          completedAt: null,
          dueAt: { lte: new Date() },
        },
        data: { sentAt: new Date() },
      });

      if (!result.count) return false;

      await tx.notification.create({
        data: {
          profileId,
          title: "Reminder",
          content: reminder.title,
          link: reminder.link,
        },
      });
      return true;
    });

    if (!claimed || !webPushConfigured) return;

    const subscriptions = await db.pushSubscription.findMany({ where: { profileId } });
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
      if (outcome.status === "rejected" && [404, 410].includes(outcome.reason?.statusCode)) {
        return [subscriptions[index].endpoint];
      }
      if (outcome.status === "rejected") {
        apiLogger.warn({ statusCode: outcome.reason?.statusCode }, "Reminder push delivery failed");
      }
      return [];
    });

    if (expiredEndpoints.length) {
      await db.pushSubscription.deleteMany({ where: { endpoint: { in: expiredEndpoints } } });
    }
  }));
}
