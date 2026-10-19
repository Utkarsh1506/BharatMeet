import { db } from "@/lib/db";

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

  await db.notification.createMany({
    data: Array.from(mentionedProfileIds).map((profileId) => ({
      profileId,
      title: "You were mentioned",
      content: `${authorName} mentioned you in a chat`,
      link,
    })),
  });

  return mentionedProfileIds.size;
};
