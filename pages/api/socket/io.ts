import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { verifyToken } from "@clerk/backend";

import { NextApiResponseServerIo } from "@/types";
import { db } from "@/lib/db";
import { checkRateLimit, socketEventLimiter } from "@/lib/rate-limit";
import { socketLogger, logSocketEvent } from "@/lib/logger";

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
    const allowedOrigins = process.env.NEXT_PUBLIC_SITE_URL
      ? [process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000", "https://localhost:3000"]
      : ["http://localhost:3000", "https://localhost:3000"];

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
      }).catch(() => socket.disconnect(true));

      socket.on("presence:set-status", async (status: unknown) => {
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
        await db.profile.update({
          where: { id: socket.data.profileId },
          data: { presenceStatus: nextStatus },
        });
        publishPresence();
      });

      socket.on("disconnect", () => {
        publishPresence(socket.id);
      });

      socket.on("join-chat", async ({ chatId, type }) => {
        if (typeof chatId !== "string" || !["channel", "conversation"].includes(type)) {
          return;
        }

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
      });

      socket.on("typing", async ({ chatId, isTyping }) => {
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

      socket.on("leave-chat", ({ chatId }) => {
        if (typeof chatId === "string") {
          socket.leave(`chat:${chatId}:messages`);
        }
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}

export default ioHandler;
