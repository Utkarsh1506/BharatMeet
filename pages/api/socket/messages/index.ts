import { NextApiRequest } from "next";

import { NextApiResponseServerIo } from "@/types";
import { currentProfilePages } from "@/lib/current-profile-pages";
import { db } from "@/lib/db";
import { createMessageSchema } from "@/lib/message-schema";
import { createMentionNotifications } from "@/lib/notifications";
import { apiLogger } from "@/lib/logger";
import { checkRateLimit, messageLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/query-validation";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIo,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const profile = await currentProfilePages(req);
    const result = createMessageSchema.safeParse(req.body);
    const { serverId, channelId } = req.query;
    
    if (!profile) {
      return res.status(401).json({ error: "Unauthorized" });
    }    

    const rateLimit = await checkRateLimit(messageLimiter, profile.id);
    if (!rateLimit.success) {
      return res.status(429).setHeader("Retry-After", "10").json({ error: "Too many messages. Please slow down." });
    }

    const parsedServerId = uuidSchema.safeParse(serverId);
    const parsedChannelId = uuidSchema.safeParse(channelId);
    if (!parsedServerId.success || !parsedChannelId.success) {
      return res.status(400).json({ error: "Invalid workspace or room ID" });
    }
          
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message || "Invalid message" });
    }

    const server = await db.server.findFirst({
      where: {
        id: parsedServerId.data,
        members: {
          some: {
            profileId: profile.id
          }
        }
      },
      include: {
        members: {
          include: {
            profile: { select: { id: true, name: true } },
          },
        },
      }
    });

    if (!server) {
      return res.status(404).json({ message: "Server not found" });
    }

    const channel = await db.channel.findFirst({
      where: {
        id: parsedChannelId.data,
        serverId: parsedServerId.data,
      }
    });

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    if (result.data.replyToId) {
      const replyTarget = await db.message.findFirst({
        where: { id: result.data.replyToId, channelId: channel.id },
        select: { id: true },
      });

      if (!replyTarget) {
        return res.status(400).json({ error: "Reply target must be in this channel" });
      }
    }

    const member = server.members.find((member) => member.profileId === profile.id);

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const message = await db.message.create({
      data: {
        content: result.data.content,
        fileUrl: result.data.fileUrl,
        channelId: parsedChannelId.data,
        memberId: member.id,
        replyToId: result.data.replyToId,
      },
      include: {
        member: {
          include: {
            profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
          }
        },
        replyTo: {
          include: {
            member: {
              include: {
                profile: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    try {
      await createMentionNotifications({
        content: result.data.content,
        authorProfileId: profile.id,
        authorName: profile.name,
        link: `/servers/${server.id}/channels/${channel.id}`,
        profiles: server.members.map(({ profile: memberProfile }) => ({
          id: memberProfile.id,
          name: memberProfile.name,
        })),
      });
    } catch (notificationError) {
      apiLogger.error({ error: notificationError, messageId: message.id }, "Failed to create mention notifications");
    }

    const channelKey = `chat:${parsedChannelId.data}:messages`;

    res?.socket?.server?.io?.to(channelKey).emit(channelKey, message);

    Object.entries(getRateLimitHeaders(rateLimit)).forEach(([name, value]) => res.setHeader(name, value));
    return res.status(200).json(message);
  } catch (error) {
    apiLogger.error({ error, url: req.url }, "Failed to create message");
    return res.status(500).json({ message: "Internal Error" }); 
  }
}
