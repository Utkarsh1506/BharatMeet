import { NextApiRequest } from "next";

import { NextApiResponseServerIo } from "@/types";
import { currentProfilePages } from "@/lib/current-profile-pages";
import { db } from "@/lib/db";
import { updateMessageSchema } from "@/lib/message-schema";
import { uuidSchema } from "@/lib/query-validation";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { apiLogger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIo,
) {
  if (req.method !== "DELETE" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const profile = await currentProfilePages(req);
    const { directMessageId, conversationId } = req.query;

    if (!profile) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsedMessageId = uuidSchema.safeParse(directMessageId);
    const parsedConversationId = uuidSchema.safeParse(conversationId);
    if (!parsedMessageId.success || !parsedConversationId.success) {
      return res.status(400).json({ error: "Invalid message or conversation ID" });
    }

    const rateLimit = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimit.success) return res.status(429).json({ error: "Too many requests. Please slow down." });

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID missing" });
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
      return res.status(404).json({ error: "Conversation not found" });
    }

    const member = conversation.memberOne.profileId === profile.id ? conversation.memberOne : conversation.memberTwo;

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    let directMessage = await db.directMessage.findFirst({
      where: {
        id: parsedMessageId.data,
        conversationId: parsedConversationId.data,
      },
      include: {
        member: {
          include: {
            profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
          }
        }
      }
    })

    if (!directMessage || directMessage.deleted) {
      return res.status(404).json({ error: "Message not found" });
    }

    const isMessageOwner = directMessage.memberId === member.id;

    if (!isMessageOwner) {
      return res.status(403).json({ error: "You cannot modify this message" });
    }

    if (req.method === "DELETE") {
      directMessage = await db.directMessage.update({
        where: {
          id: parsedMessageId.data,
        },
        data: {
          fileUrl: null,
          content: "This message has been deleted.",
          deleted: true,
        },
        include: {
          member: {
            include: {
              profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
            }
          }
        }
      })
    }

    if (req.method === "PATCH") {
      const result = updateMessageSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: result.error.issues[0]?.message || "Invalid message" });
      }

      directMessage = await db.directMessage.update({
        where: {
          id: parsedMessageId.data,
        },
        data: {
          content: result.data.content,
        },
        include: {
          member: {
            include: {
              profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
            }
          }
        }
      })
    }

    const updateKey = `chat:${conversation.id}:messages:update`;

    res?.socket?.server?.io?.to(`chat:${conversationId}:messages`).emit(updateKey, directMessage);

    Object.entries(getRateLimitHeaders(rateLimit)).forEach(([name, value]) => res.setHeader(name, value));
    return res.status(200).json(directMessage);
  } catch (error) {
    apiLogger.error({ error, url: req.url }, "Failed to modify direct message");
    return res.status(500).json({ error: "Internal Error" });
  }
}
