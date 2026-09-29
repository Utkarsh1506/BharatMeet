import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { verifyToken } from "@clerk/backend";

import { NextApiResponseServerIo } from "@/types";
import { db } from "@/lib/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io";
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: path,
      // @ts-ignore
      addTrailingSlash: false,
    });

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        const secretKey = process.env.CLERK_SECRET_KEY;

        if (!token || !secretKey) {
          return next(new Error("Unauthorized"));
        }

        const payload = await verifyToken(token, { secretKey });
        socket.data.userId = payload.sub;
        next();
      } catch (error) {
        console.error("[SOCKET_AUTH]", error);
        next(new Error("Unauthorized"));
      }
    });

    io.on("connection", (socket) => {
      socket.on("join-chat", async ({ chatId, type }) => {
        if (typeof chatId !== "string" || !["channel", "conversation"].includes(type)) {
          return;
        }

        const profile = await db.profile.findUnique({
          where: { userId: socket.data.userId },
          select: { id: true },
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
          socket.join(`chat:${chatId}:messages`);
        }
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
