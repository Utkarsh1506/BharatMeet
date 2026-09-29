import { NextApiRequest } from "next";

import { NextApiResponseServerIo } from "@/types";
import { currentProfilePages } from "@/lib/current-profile-pages";
import { db } from "@/lib/db";
import { createMessageSchema } from "@/lib/message-schema";

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
  
    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID missing" });
    }
          
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message || "Invalid message" });
    }


    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId as string,
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
            profile: true,
          }
        },
        memberTwo: {
          include: {
            profile: true,
          }
        }
      }
    })

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const member = conversation.memberOne.profileId === profile.id ? conversation.memberOne : conversation.memberTwo

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const message = await db.directMessage.create({
      data: {
        content: result.data.content,
        fileUrl: result.data.fileUrl,
        conversationId: conversationId as string,
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            profile: true,
          }
        }
      }
    });

    const channelKey = `chat:${conversationId}:messages`;

    res?.socket?.server?.io?.to(channelKey).emit(channelKey, message);

    return res.status(200).json(message);
  } catch (error) {
    console.log("[DIRECT_MESSAGES_POST]", error);
    return res.status(500).json({ message: "Internal Error" }); 
  }
}