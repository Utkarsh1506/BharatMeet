"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback
} from "react";
import { useAuth } from "@clerk/nextjs";
import { io as ClientIO, Socket } from "socket.io-client";

export type PresenceStatus = "online" | "away" | "dnd" | "offline";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  presenceByUserId: Record<string, PresenceStatus>;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  presenceByUserId: {},
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({
  children
}: {
  children: React.ReactNode
}) => {
  const { getToken, isLoaded } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresenceStatus>>({});

  // Use ref to track if we've already initiated connection
  const isConnecting = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  // Memoized handlers to prevent recreating on every render
  const handleConnect = useCallback(() => {
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setPresenceByUserId({});
  }, []);

  const handlePresenceState = useCallback(({ users }: { users: Array<{ userId: string; status: PresenceStatus }> }) => {
    setPresenceByUserId(
      Object.fromEntries(users.map(({ userId, status }) => [userId, status]))
    );
  }, []);

  useEffect(() => {
    // Only run when auth is loaded
    if (!isLoaded) {
      return;
    }

    // Prevent multiple simultaneous connections
    if (isConnecting.current || socketRef.current?.connected) {
      return;
    }

    let socketInstance: Socket | null = null;
    let isMounted = true;

    const connect = async () => {
      isConnecting.current = true;

      try {
        const token = await getToken({ skipCache: true });

        if (!token || !isMounted) {
          isConnecting.current = false;
          return;
        }

        socketInstance = ClientIO(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin, {
          path: "/api/socket/io",
          addTrailingSlash: false,
          // Start with HTTP long-polling and upgrade to WebSocket when available.
          // Socket.IO invokes this for each connection attempt. Fetching a
          // fresh Clerk token here avoids reusing an expired token on reconnect.
          auth: (callback) => {
            void getToken({ skipCache: true })
              .then((freshToken: string | null) => callback({ token: freshToken || "" }))
              .catch(() => callback({ token: "" }));
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        // Attach event listeners
        socketInstance.on("connect", handleConnect);
        socketInstance.on("disconnect", handleDisconnect);
        socketInstance.on("presence:state", handlePresenceState);

        socketRef.current = socketInstance;

        if (isMounted) {
          setSocket(socketInstance);
        }
      } catch (error) {
        // Only log in development to avoid polluting production logs
        if (process.env.NODE_ENV === 'development') {
          console.error("[SOCKET_CONNECTION_ERROR]", error);
        }
      } finally {
        isConnecting.current = false;
      }
    };

    connect();

    // Cleanup function
    return () => {
      isMounted = false;

      if (socketInstance) {
        // Remove all event listeners to prevent memory leaks
        socketInstance.off("connect", handleConnect);
        socketInstance.off("disconnect", handleDisconnect);
        socketInstance.off("presence:state", handlePresenceState);

        // Disconnect the socket
        socketInstance.disconnect();
        socketRef.current = null;
      }

      isConnecting.current = false;
    };
  }, [isLoaded, getToken, handleConnect, handleDisconnect, handlePresenceState]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, presenceByUserId }}>
      {children}
    </SocketContext.Provider>
  );
}
