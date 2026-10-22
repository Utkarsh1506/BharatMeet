import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN?.trim();
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

export const reminderSchedulerConfigured = Boolean(token && currentSigningKey && nextSigningKey && siteUrl?.startsWith("https://"));
const client = token ? new Client({ token }) : null;
const MAX_DELAY_SECONDS = 6 * 24 * 60 * 60;

export async function scheduleReminderDelivery(reminderId: string, dueAt: Date) {
  if (!client || !siteUrl?.startsWith("https://")) return false;
  const requestedTime = Math.floor(dueAt.getTime() / 1000);
  const notBefore = Math.min(requestedTime, Math.floor(Date.now() / 1000) + MAX_DELAY_SECONDS);
  await client.publishJSON({
    url: `${siteUrl}/api/reminders/dispatch`,
    body: { reminderId },
    notBefore,
    retries: 3,
    label: `reminder-${reminderId}`,
  });
  return true;
}
