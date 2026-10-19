import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { verifyToken } from "@clerk/backend";

import { NextApiResponseServerIo } from "@/types";
import { db } from "@/lib/db";
import { checkRateLimit, socketEventLimiter } from "@/lib/rate-limit";
import { socketLogger, logSocketEvent } from "@/lib/logger";
import { uuidSchema } from "@/lib/query-validation";
import { env, isDevelopment } from "@/lib/env";

const PRESENCE_STATUSES = ["online", "away", "dnd", "offline"] as const;
type PresenceStatus = typeof PRESENCE_STATUSES[number];

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  // Gracefully log warning in serverless environments (e.g., Vercel)
  if (process.env.VERCEL) {
    console.warn(
      "⚠️ Socket.IO is not fully supported on Vercel Serverless Functions. " +
      "A persistent Node.js server or a dedicated WebSocket provider is required for optimal performance and real-time connectivity."
    );
  }

  if (!res.socket.server.io) {
    const path = "/api/socket/io";
    const httpServer: NetServer = res.socket.server as any;

    // Configure CORS for Socket.IO
    const allowedOrigins = [
      env.NEXT_PUBLIC_SITE_URL ? new URL(env.NEXT_PUBLIC_SITE_URL).origin : undefined,
      ...(isDevelopment ? ["http://localhost:3000", "https://localhost:3000"] : []),
    ].filter((origin): origin is string => Boolean(origin));

    const io = new ServerIO(httpServer, {
      path: path,
      // @ts-ignore
      addTrailingSlash: false,
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Authorization", "Content-Type"],
      },
      transports: ["polling", "websocket"],
      allowEIO3: true,
    });

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        const secretKey = process.env.CLERK_SECRET_KEY;

        if (!token || !secretKey) {
          return next(new Error("Unauthorized"));
        }

        const payload = await verifyToken(token, { secretKey, issuer: null });
        socket.data.userId = payload.sub;
        next();
      } catch (error) {
        socketLogger.error({ error }, "Socket authentication failed");
        next(new Error("Unauthorized"));
      }
    });

    io.on("connection", (socket) => {
      const publishPresence = (excludedSocketId?: string) => {
        const users = Array.from(
          new Map(
            Array.from(io.sockets.sockets.values())
              .filter((activeSocket) => activeSocket.id !== excludedSocketId)
              .filter((activeSocket) => typeof activeSocket.data.profileId === "string")
              .map((activeSocket) => [
                activeSocket.data.profileId,
                activeSocket.data.presenceStatus || "online",
              ] as const),
          ).entries(),
        ).map(([userId, status]) => ({ userId, status }));

        io.emit("presence:state", { users });
      };

      db.profile.findUnique({
        where: { userId: socket.data.userId },
        select: { id: true, name: true, presenceStatus: true },
      }).then((profile) => {
        if (!profile) {
          socket.disconnect(true);
          return;
        }

        socket.data.profileId = profile.id;
        socket.data.profileName = profile.name;
        socket.data.presenceStatus = PRESENCE_STATUSES.includes(profile.presenceStatus as PresenceStatus)
          ? profile.presenceStatus
          : "online";
        socket.emit("presence:self", { status: socket.data.presenceStatus });
        publishPresence();
      }).catch((error) => {
        socketLogger.error({ error, userId: socket.data.userId }, "Failed to load socket profile");
        socket.disconnect(true);
      });

      socket.on("presence:set-status", async (status: unknown) => {
        if (typeof socket.data.profileId !== "string") return;
        // Rate limit presence updates
        const rateLimitResult = await checkRateLimit(
          socketEventLimiter,
          `${socket.data.profileId}:presence`
        );
        if (!rateLimitResult.success) {
          socket.emit("error", { message: "Too many presence updates" });
          return;
        }

        if (!PRESENCE_STATUSES.includes(status as PresenceStatus)) {
          return;
        }

        const nextStatus = status as PresenceStatus;
        socket.data.presenceStatus = nextStatus;
        try {
          await db.profile.update({
            where: { id: socket.data.profileId },
            data: { presenceStatus: nextStatus },
          });
          publishPresence();
        } catch (error) {
          socketLogger.error({ error, profileId: socket.data.profileId }, "Failed to update presence");
        }
      });

      socket.on("disconnect", () => {
        publishPresence(socket.id);
      });

      socket.on("join-chat", async (payload: unknown) => {
        if (!payload || typeof payload !== "object") return;
        const { chatId, type } = payload as { chatId?: unknown; type?: unknown };
        if (
          typeof chatId !== "string" ||
          !uuidSchema.safeParse(chatId).success ||
          (type !== "channel" && type !== "conversation")
        ) {
          return;
        }

        const joinLimit = await checkRateLimit(
          socketEventLimiter,
          `${socket.data.userId}:join-chat`,
        );
        if (!joinLimit.success) {
          socket.emit("error", { message: "Too many room join requests" });
          return;
        }

        try {
        const profile = await db.profile.findUnique({
          where: { userId: socket.data.userId },
          select: { id: true, name: true },
        });

        if (!profile) {
          return;
        }

        const access = type === "channel"
          ? await db.channel.findFirst({
              where: {
                id: chatId,
                server: { members: { some: { profileId: profile.id } } },
              },
              select: { id: true },
            })
          : await db.conversation.findFirst({
              where: {
                id: chatId,
                OR: [
                  { memberOne: { profileId: profile.id } },
                  { memberTwo: { profileId: profile.id } },
                ],
              },
              select: { id: true },
            });

        if (access) {
          socket.data.profileName = profile.name;
          socket.join(`chat:${chatId}:messages`);
        }
        } catch (error) {
          socketLogger.error({ error, chatId, userId: socket.data.userId }, "Failed to join chat room");
        }
      });

      socket.on("typing", async (payload: unknown) => {
        if (!payload || typeof payload !== "object" || typeof socket.data.profileId !== "string") return;
        const { chatId, isTyping } = payload as { chatId?: unknown; isTyping?: unknown };
        // Rate limit typing events
        const rateLimitResult = await checkRateLimit(
          socketEventLimiter,
          `${socket.data.profileId}:typing`
        );
        if (!rateLimitResult.success) {
          return;
        }

        if (
          typeof chatId !== "string" ||
          !uuidSchema.safeParse(chatId).success ||
          typeof isTyping !== "boolean" ||
          !socket.rooms.has(`chat:${chatId}:messages`)
        ) {
          return;
        }

        socket.to(`chat:${chatId}:messages`).emit(`chat:${chatId}:typing`, {
          userId: socket.data.userId,
          name: socket.data.profileName || "A teammate",
          isTyping,
        });
      });

      socket.on("leave-chat", (payload: unknown) => {
        if (payload && typeof payload === "object" && "chatId" in payload && typeof payload.chatId === "string") {
          const { chatId } = payload;
          if (!uuidSchema.safeParse(chatId).success) return;
          socket.leave(`chat:${chatId}:messages`);
        }
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}

export default ioHandler;
