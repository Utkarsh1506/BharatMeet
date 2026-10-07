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
  const mentionTokens = Array.from(
    new Set(
      Array.from(content.matchAll(/@([a-zA-Z0-9._-]+)/g)).map((match) => match[1].trim().toLowerCase())
    )
  );

  if (!mentionTokens.length) {
    return 0;
  }

  const mentionedProfileIds = new Set<string>();

  for (const profile of profiles) {
    if (profile.id === authorProfileId) {
      continue;
    }

    const normalizedName = profile.name.toLowerCase();
    const firstName = profile.name.split(/\s+/)[0]?.toLowerCase() ?? normalizedName;

    const isMentioned = mentionTokens.some((token) => {
      const tokenValue = token.trim().toLowerCase();
      return (
        tokenValue === normalizedName ||
        tokenValue === firstName ||
        normalizedName.includes(tokenValue) ||
        firstName.includes(tokenValue)
      );
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
