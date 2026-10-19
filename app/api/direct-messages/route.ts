import { NextResponse } from "next/server";
import { DirectMessage } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { validateQueryParams, directMessagesQuerySchema } from "@/lib/query-validation";
import { handleApiError, ApiErrors } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";

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
