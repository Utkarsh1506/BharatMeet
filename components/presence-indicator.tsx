"use client";

import { cn } from "@/lib/utils";
import { useSocket } from "@/components/providers/socket-provider";

interface PresenceIndicatorProps {
  profileId: string;
  compact?: boolean;
}

const statusLabels = {
  online: "Online",
  away: "Away",
  dnd: "Do not disturb",
  offline: "Offline",
} as const;

export const PresenceIndicator = ({
  profileId,
  compact = false,
}: PresenceIndicatorProps) => {
  const { presenceByUserId } = useSocket();
  const status = presenceByUserId[profileId] || "offline";

  return (
    <span className={cn("inline-flex items-center gap-1.5", compact && "gap-1")}>
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 rounded-full",
          status === "online" && "bg-emerald-400",
          status === "away" && "bg-amber-400",
          status === "dnd" && "bg-rose-400",
          status === "offline" && "bg-zinc-500",
        )}
      />
      <span>{statusLabels[status]}</span>
    </span>
  );
};