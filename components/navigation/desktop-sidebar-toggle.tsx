"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useServerNavigation } from "@/components/providers/server-navigation-provider";
import { Button } from "@/components/ui/button";

export const DesktopSidebarToggle = () => {
  const navigation = useServerNavigation();
  const collapsed = navigation?.isSidebarCollapsed ?? false;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={collapsed ? "Show workspace sidebar" : "Hide workspace sidebar"}
      aria-pressed={!collapsed}
      title={collapsed ? "Show sidebar" : "Hide sidebar"}
      onClick={navigation?.toggleSidebar}
      className="hidden h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground lg:inline-flex"
    >
      {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
    </Button>
  );
};
