import { db } from "@/lib/db";
import { sendWebPush, webPushConfigured } from "@/lib/web-push";

interface MentionProfile {
  id: string;
  name: string;
}

interface CreateMentionNotificationsProps {
  content: string;
  authorProfileId: string;
  authorName: string;
  link: string;
  profiles: MentionProfile[];
}

export const createMentionNotifications = async ({
  content,
  authorProfileId,
  authorName,
  link,
  profiles,
}: CreateMentionNotificationsProps) => {
  if (!content.includes("@") || !profiles.length) {
    return 0;
  }

  const mentionedProfileIds = new Set<string>();

  for (const profile of profiles) {
    if (profile.id === authorProfileId) {
      continue;
    }

    const candidates = Array.from(new Set([
      profile.name.trim(),
      profile.name.trim().split(/\s+/)[0] ?? "",
    ].filter(Boolean)));
    const isMentioned = candidates.some((candidate) => {
      const escapedCandidate = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mention = new RegExp(
        `(^|[^\\p{L}\\p{N}_])@${escapedCandidate}(?=$|[^\\p{L}\\p{N}_])`,
        "iu",
      );

      return mention.test(content);
    });

    if (isMentioned) {
      mentionedProfileIds.add(profile.id);
    }
  }

  if (!mentionedProfileIds.size) {
    return 0;
  }

  const notifications = Array.from(mentionedProfileIds).map((profileId) => ({
      profileId,
      title: "You were mentioned",
      content: `${authorName} mentioned you in a chat`,
      link,
    }));

  await db.notification.createMany({ data: notifications });

  if (webPushConfigured) {
    const subscriptions = await db.pushSubscription.findMany({
      where: { profileId: { in: Array.from(mentionedProfileIds) } },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    const outcomes = await Promise.allSettled(subscriptions.map((subscription) => sendWebPush({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, {
      title: "You were mentioned · Bharat Meet",
      body: `${authorName} mentioned you in a chat`,
      url: link,
      tag: `mention-${Date.now()}`,
    })));
    const expired = outcomes.flatMap((outcome, index) => outcome.status === "rejected" &&
      (outcome.reason?.statusCode === 404 || outcome.reason?.statusCode === 410)
      ? [subscriptions[index].endpoint]
      : []);
    if (expired.length) {
      await db.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
    }
  }

  return mentionedProfileIds.size;
};
