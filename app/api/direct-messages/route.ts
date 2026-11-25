import { NextResponse } from "next/server";
import { DirectMessage } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { validateQueryParams, directMessagesQuerySchema, uuidSchema } from "@/lib/query-validation";
import { handleApiError, ApiErrors } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, messageLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { createMessageSchema } from "@/lib/message-schema";
import { createMentionNotifications } from "@/lib/notifications";

const MESSAGES_BATCH = 10;

export const dynamic = "force-dynamic";

export async function GET(
  req: Request
) {
  try {
    const profile = await currentProfile();
    const { searchParams } = new URL(req.url);

    if (!profile) {
      return ApiErrors.unauthorized();
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(apiLimiter, profile.id);
    if (!rateLimitResult.success) {
      return ApiErrors.rateLimitExceeded(
        "Too many requests. Please slow down.",
        getRateLimitHeaders(rateLimitResult)
      );
    }

    // Validate query parameters
    const validation = validateQueryParams(directMessagesQuerySchema, searchParams);
    if (!validation.success) {
      return handleApiError(validation.error);
    }

    const { conversationId, cursor } = validation.data;

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { memberOne: { profileId: profile.id } },
          { memberTwo: { profileId: profile.id } },
        ]
      },
      select: { id: true }
    });

    if (!conversation) {
      return ApiErrors.notFound("Conversation not found");
    }

    if (cursor) {
      const cursorMessage = await db.directMessage.findFirst({
        where: { id: cursor, conversationId },
        select: { id: true },
      });
      if (!cursorMessage) return ApiErrors.badRequest("Message cursor does not belong to this conversation");
    }

    let messages: DirectMessage[] = [];

    if (cursor) {
      messages = await db.directMessage.findMany({
        take: MESSAGES_BATCH,
        skip: 1,
        cursor: {
          id: cursor,
        },
        where: {
          conversationId,
        },
        include: {
          member: {
            include: {
              profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true } },
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
          },
          reactions: true,
        },
        orderBy: {
          createdAt: "desc",
        }
      })
    } else {
      messages = await db.directMessage.findMany({
        take: MESSAGES_BATCH,
        where: {
          conversationId,
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
          },
          reactions: true,
        },
        orderBy: {
          createdAt: "desc",
        }
      });
    }

    let nextCursor = null;

    if (messages.length === MESSAGES_BATCH) {
      nextCursor = messages[MESSAGES_BATCH - 1].id;
    }

    return NextResponse.json({
      items: messages,
      nextCursor
    }, {
      headers: getRateLimitHeaders(rateLimitResult)
    });
  } catch (error) {
    apiLogger.error({ error, conversationId: req.url }, "Failed to fetch direct messages");
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();

    const url = new URL(req.url);
    const conversationId = uuidSchema.safeParse(url.searchParams.get("conversationId"));
    if (!conversationId.success) return ApiErrors.badRequest("Invalid conversation ID");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return ApiErrors.badRequest("Request body must be valid JSON");
    }

    const parsedMessage = createMessageSchema.safeParse(body);
    if (!parsedMessage.success) {
      return ApiErrors.badRequest(parsedMessage.error.issues[0]?.message || "Invalid message");
    }

    const rateLimit = await checkRateLimit(messageLimiter, profile.id);
    if (!rateLimit.success) {
      return ApiErrors.rateLimitExceeded(
        "Too many messages. Please slow down.",
        { ...getRateLimitHeaders(rateLimit), "Retry-After": "10" },
      );
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId.data,
        OR: [
          { memberOne: { profileId: profile.id } },
          { memberTwo: { profileId: profile.id } },
        ],
      },
      include: {
        memberOne: { include: { profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } } } },
        memberTwo: { include: { profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } } } },
      },
    });
    if (!conversation) return ApiErrors.notFound("Conversation not found");

    if (parsedMessage.data.replyToId) {
      const replyTarget = await db.directMessage.findFirst({
        where: { id: parsedMessage.data.replyToId, conversationId: conversation.id },
        select: { id: true },
      });
      if (!replyTarget) return ApiErrors.badRequest("Reply target must be in this conversation");
    }

    const member = conversation.memberOne.profileId === profile.id
      ? conversation.memberOne
      : conversation.memberTwo;

    const message = await db.directMessage.create({
      data: {
        content: parsedMessage.data.content,
        fileUrl: parsedMessage.data.fileUrl,
        conversationId: conversation.id,
        memberId: member.id,
        replyToId: parsedMessage.data.replyToId,
      },
      include: {
        member: { include: { profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } } } },
        replyTo: { include: { member: { include: { profile: { select: { id: true, name: true } } } } } },
      },
    });

    try {
      await createMentionNotifications({
        content: parsedMessage.data.content,
        authorProfileId: profile.id,
        authorName: profile.name,
        link: `/servers/${member.serverId}/conversations/${member.id}`,
        profiles: [conversation.memberOne.profile, conversation.memberTwo.profile].map(({ id, name }) => ({ id, name })),
      });
    } catch (notificationError) {
      apiLogger.error({ error: notificationError, messageId: message.id }, "Failed to create direct message mention notifications");
    }

    return NextResponse.json(message, {
      status: 201,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    apiLogger.error({ error, url: req.url }, "Failed to create direct message");
    return handleApiError(error);
  }
}
