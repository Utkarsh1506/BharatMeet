import webPush, { type PushSubscription } from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim();

export const webPushPublicKey = publicKey || "";
export let webPushConfigured = false;

if (publicKey && privateKey && subject) {
  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    webPushConfigured = true;
  } catch (error) {
    console.error("[WEB_PUSH_CONFIG] Invalid VAPID settings; push alerts are disabled.", error instanceof Error ? error.message : "Invalid configuration");
  }
}

export async function sendWebPush(subscription: PushSubscription, payload: Record<string, unknown>) {
  if (!webPushConfigured) return;
  await webPush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
}
