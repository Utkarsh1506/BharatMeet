import { NextResponse } from "next/server";
import { Message } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { validateQueryParams, messagesQuerySchema } from "@/lib/query-validation";
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
    const validation = validateQueryParams(messagesQuerySchema, searchParams);
    if (!validation.success) {
      return handleApiError(validation.error);
    }

    const { channelId, cursor } = validation.data;

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        server: {
          members: {
            some: {
              profileId: profile.id,
            }
          }
        }
      },
      select: { id: true }
    });

    if (!channel) {
      return ApiErrors.notFound("Channel not found");
    }

    let messages: Message[] = [];

    if (cursor) {
      messages = await db.message.findMany({
        take: MESSAGES_BATCH,
        skip: 1,
        cursor: {
          id: cursor,
        },
        where: {
          channelId,
        },
        include: {
          member: {
            include: {
              profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
            }
          },
          reactions: {
            include: {
              member: {
                include: {
                  profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: "desc",
        }
      })
    } else {
      messages = await db.message.findMany({
        take: MESSAGES_BATCH,
        where: {
          channelId,
        },
        include: {
          member: {
            include: {
              profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
            }
          },
          reactions: {
            include: {
              member: {
                include: {
                  profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
                }
              }
            }
          }
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
    apiLogger.error({ error, channelId: req.url }, "Failed to fetch messages");
    return handleApiError(error);
  }
}