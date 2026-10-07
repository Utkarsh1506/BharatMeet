import { useEffect, useState } from "react";

import { useSocket } from "@/components/providers/socket-provider";

interface TypingUser {
  userId: string;
  name: string;
}

interface ChatTypingProps {
  chatId: string;
}

export const useChatTyping = ({ chatId }: ChatTypingProps) => {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const typingKey = `chat:${chatId}:typing`;
    const timeouts = new Map<string, number>();

    const onTyping = ({ userId, name, isTyping }: TypingUser & { isTyping: boolean }) => {
      if (isTyping) {
        setTypingUsers((current) => [
          ...current.filter((user) => user.userId !== userId),
          { userId, name },
        ]);

        const existingTimeout = timeouts.get(userId);
        if (existingTimeout) {
          window.clearTimeout(existingTimeout);
        }

        timeouts.set(
          userId,
          window.setTimeout(() => {
            setTypingUsers((current) => current.filter((user) => user.userId !== userId));
            timeouts.delete(userId);
          }, 1800),
        );
        return;
      }

      setTypingUsers((current) => current.filter((user) => user.userId !== userId));
      const existingTimeout = timeouts.get(userId);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
        timeouts.delete(userId);
      }
    };

    socket.on(typingKey, onTyping);

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      socket.off(typingKey, onTyping);
      setTypingUsers([]);
    };
  }, [chatId, socket]);

  return typingUsers;
};