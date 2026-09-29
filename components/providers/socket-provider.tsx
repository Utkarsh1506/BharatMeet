"use client";

import { 
  createContext,
  useContext,
  useEffect,
  useState
} from "react";
import { useAuth } from "@clerk/nextjs";
import { io as ClientIO } from "socket.io-client";

type SocketContextType = {
  socket: any | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ 
  children 
}: { 
  children: React.ReactNode 
}) => {
  const { getToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let socketInstance: any;

    const connect = async () => {
      const token = await getToken();

      if (!token) {
        return;
      }

      socketInstance = new (ClientIO as any)(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin, {
        path: "/api/socket/io",
        addTrailingSlash: false,
        transports: ["polling"],
        auth: { token },
      });

      socketInstance.on("connect", () => {
        setIsConnected(true);
      });

      socketInstance.on("disconnect", () => {
        setIsConnected(false);
      });

      setSocket(socketInstance);
    };

    connect();

    return () => {
      socketInstance?.disconnect();
    }
  }, [getToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}