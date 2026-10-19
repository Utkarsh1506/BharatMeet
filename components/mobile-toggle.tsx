"use client";

import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ServerSidebar } from "@/components/server/server-sidebar";
import { useServerNavigation } from "@/components/providers/server-navigation-provider";

export const MobileToggle = ({
  serverId
}: {
  serverId: string;
}) => {
  const navigation = useServerNavigation();

  if (!navigation?.server || !navigation.profileId || !navigation.role || navigation.server.id !== serverId) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open workspace navigation"
          className="lg:hidden"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-[360px] gap-0 overflow-hidden p-0">
        <div className="h-full min-w-0 overflow-hidden">
          <ServerSidebar server={navigation.server} profileId={navigation.profileId} role={navigation.role} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
