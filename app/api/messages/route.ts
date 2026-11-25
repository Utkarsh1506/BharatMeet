import { NextResponse } from "next/server";
import { Message } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { validateQueryParams, messagesQuerySchema, uuidSchema } from "@/lib/query-validation";
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

    if (cursor) {
      const cursorMessage = await db.message.findFirst({
        where: { id: cursor, channelId },
        select: { id: true },
      });
      if (!cursorMessage) return ApiErrors.badRequest("Message cursor does not belong to this channel");
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
          reactions: { select: { id: true, emoji: true, memberId: true, messageId: true } }
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
          replyTo: {
            include: {
              member: {
                include: {
                  profile: { select: { id: true, name: true } }
                }
              }
            }
          },
          reactions: { select: { id: true, emoji: true, memberId: true, messageId: true } }
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

export async function POST(req: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();

    const url = new URL(req.url);
    const channelId = uuidSchema.safeParse(url.searchParams.get("channelId"));
    const requestedServerId = url.searchParams.get("serverId");
    const serverId = requestedServerId ? uuidSchema.safeParse(requestedServerId) : null;
    if (!channelId.success || (serverId && !serverId.success)) {
      return ApiErrors.badRequest("Invalid room or workspace ID");
    }

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

    const channel = await db.channel.findFirst({
      where: {
        id: channelId.data,
        ...(serverId ? { serverId: serverId.data } : {}),
        server: { members: { some: { profileId: profile.id } } },
      },
      select: { id: true, serverId: true },
    });
    if (!channel) return ApiErrors.notFound("Room not found");

    const member = await db.member.findFirst({
      where: { serverId: channel.serverId, profileId: profile.id },
      select: { id: true },
    });
    if (!member) return ApiErrors.notFound("Workspace member not found");

    if (parsedMessage.data.replyToId) {
      const replyTarget = await db.message.findFirst({
        where: { id: parsedMessage.data.replyToId, channelId: channel.id },
        select: { id: true },
      });
      if (!replyTarget) return ApiErrors.badRequest("Reply target must be in this room");
    }

    const message = await db.message.create({
      data: {
        content: parsedMessage.data.content,
        fileUrl: parsedMessage.data.fileUrl,
        channelId: channel.id,
        memberId: member.id,
        replyToId: parsedMessage.data.replyToId,
      },
      include: {
        member: {
          include: {
            profile: { select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true, createdAt: true, updatedAt: true } },
          },
        },
        replyTo: {
          include: {
            member: { include: { profile: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    try {
      const server = await db.server.findUnique({
        where: { id: channel.serverId },
        select: { members: { select: { profile: { select: { id: true, name: true } } } } },
      });
      await createMentionNotifications({
        content: parsedMessage.data.content,
        authorProfileId: profile.id,
        authorName: profile.name,
        link: `/servers/${channel.serverId}/channels/${channel.id}`,
        profiles: server?.members.map(({ profile: memberProfile }) => memberProfile) ?? [],
      });
    } catch (notificationError) {
      apiLogger.error({ error: notificationError, messageId: message.id }, "Failed to create mention notifications");
    }

    return NextResponse.json(message, {
      status: 201,
      headers: getRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    apiLogger.error({ error, url: req.url }, "Failed to create message");
    return handleApiError(error);
  }
}
