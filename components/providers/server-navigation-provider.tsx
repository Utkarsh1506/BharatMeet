"use client";

import { createContext, useContext, useState } from "react";
import { MemberRole } from "@prisma/client";

import type { ServerWithRelations } from "@/components/server/server-sidebar";

interface ServerNavigationValue {
  servers: Array<{ id: string; name: string; imageUrl: string }>;
  server?: ServerWithRelations;
  profileId?: string;
  role?: MemberRole;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const ServerNavigationContext = createContext<ServerNavigationValue | null>(null);

export const ServerNavigationProvider = ({
  servers,
  server,
  profileId,
  role,
  children,
}: {
  servers?: ServerNavigationValue["servers"];
  server?: ServerWithRelations;
  profileId?: string;
  role?: MemberRole;
  children: React.ReactNode;
}) => {
  const parent = useContext(ServerNavigationContext);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const value: ServerNavigationValue = {
    servers: servers ?? parent?.servers ?? [],
    server: server ?? parent?.server,
    profileId: profileId ?? parent?.profileId,
    role: role ?? parent?.role,
    isSidebarCollapsed: parent?.isSidebarCollapsed ?? isSidebarCollapsed,
    toggleSidebar: parent?.toggleSidebar ?? (() => setIsSidebarCollapsed((collapsed) => !collapsed)),
  };

  return (
    <ServerNavigationContext.Provider value={value}>
      {children}
    </ServerNavigationContext.Provider>
  );
};

export const useServerNavigation = () => useContext(ServerNavigationContext);
