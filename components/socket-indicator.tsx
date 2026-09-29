"use client";

import { useSocket } from "@/components/providers/socket-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SocketIndicator = () => {
  const { isConnected } = useSocket();

  if (!isConnected) {
    return (
      <Badge 
        variant="outline" 
        title="Realtime connection unavailable. Polling for updates."
        className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Offline
      </Badge>
    )
  }

  return (
    <Badge 
      variant="outline" 
      title="Realtime updates are active."
      className={cn("gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Live
    </Badge>
  )
}