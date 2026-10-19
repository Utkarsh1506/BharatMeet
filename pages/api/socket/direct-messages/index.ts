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
    const { conversationId } = req.query;
    
    if (!profile) {
      return res.status(401).json({ error: "Unauthorized" });
    }    

    const rateLimit = await checkRateLimit(messageLimiter, profile.id);
    if (!rateLimit.success) {
      return res.status(429).setHeader("Retry-After", "10").json({ error: "Too many messages. Please slow down." });
    }

    const parsedConversationId = uuidSchema.safeParse(conversationId);
    if (!parsedConversationId.success) return res.status(400).json({ error: "Invalid conversation ID" });
          
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message || "Invalid message" });
    }


    const conversation = await db.conversation.findFirst({
      where: {
        id: parsedConversationId.data,
        OR: [
          {
            memberOne: {
              profileId: profile.id,
            }
          },
          {
            memberTwo: {
              profileId: profile.id,
            }
          }
        ]
      },
      include: {
        memberOne: {
          include: {
            profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
          }
        },
        memberTwo: {
          include: {
            profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
          }
        }
      }
    })

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (result.data.replyToId) {
      const replyTarget = await db.directMessage.findFirst({
        where: {
          id: result.data.replyToId,
          conversationId: conversation.id,
        },
        select: { id: true },
      });

      if (!replyTarget) {
        return res.status(400).json({ error: "Reply target must be in this conversation" });
      }
    }

    const member = conversation.memberOne.profileId === profile.id ? conversation.memberOne : conversation.memberTwo

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const message = await db.directMessage.create({
      data: {
        content: result.data.content,
        fileUrl: result.data.fileUrl,
        conversationId: parsedConversationId.data,
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
        link: `/servers/${member.serverId}/conversations/${member.id}`,
        profiles: [conversation.memberOne.profile, conversation.memberTwo.profile].map((participant) => ({
          id: participant.id,
          name: participant.name,
        })),
      });
    } catch (notificationError) {
      apiLogger.error({ error: notificationError, messageId: message.id }, "Failed to create direct message mention notifications");
    }

    const channelKey = `chat:${parsedConversationId.data}:messages`;

    res?.socket?.server?.io?.to(channelKey).emit(channelKey, message);

    Object.entries(getRateLimitHeaders(rateLimit)).forEach(([name, value]) => res.setHeader(name, value));
    return res.status(200).json(message);
  } catch (error) {
    apiLogger.error({ error, url: req.url }, "Failed to create direct message");
    return res.status(500).json({ message: "Internal Error" }); 
  }
}
