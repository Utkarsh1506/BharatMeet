"use client";

import { ServerSidebar, type ServerWithRelations } from "@/components/server/server-sidebar";
import { useServerNavigation } from "@/components/providers/server-navigation-provider";
import type { MemberRole } from "@prisma/client";

export const ServerWorkspaceFrame = ({
  server,
  profileId,
  role,
  children,
}: {
  server: ServerWithRelations;
  profileId: string;
  role: MemberRole;
  children: React.ReactNode;
}) => {
  const navigation = useServerNavigation();
  const collapsed = navigation?.isSidebarCollapsed ?? false;

  return (
    <div className="h-full min-h-0 min-w-0">
      <aside
        aria-label="Workspace sidebar"
        aria-hidden={collapsed}
        className={`fixed bottom-0 left-0 top-16 z-40 hidden w-72 flex-col transition-transform duration-300 ease-out motion-reduce:transition-none lg:!flex ${collapsed ? "-translate-x-full" : "translate-x-0"}`}
      >
        <ServerSidebar server={server} profileId={profileId} role={role} />
      </aside>
      <main className={`h-full min-h-0 min-w-0 transition-[padding] duration-300 ease-out motion-reduce:transition-none ${collapsed ? "lg:pl-0" : "lg:pl-72"}`}>
        {children}
      </main>
    </div>
  );
};
