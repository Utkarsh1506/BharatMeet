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
        className="gap-1.5 rounded-full border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Offline
      </Badge>
    )
  }

  return (
    <Badge 
      variant="outline" 
      title="Realtime updates are active."
      className={cn("gap-1.5 rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Live
    </Badge>
  )
}
