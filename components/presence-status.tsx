"use client";

import { Check, Circle, Moon, MinusCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSocket, type PresenceStatus as PresenceStatusType } from "@/components/providers/socket-provider";

const statusOptions: Array<{
  value: Exclude<PresenceStatusType, "offline">;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  { value: "online", label: "Online", description: "Available for conversations", icon: <Circle className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" /> },
  { value: "away", label: "Away", description: "Step away without going offline", icon: <Moon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> },
  { value: "dnd", label: "Do not disturb", description: "Quiet the interruptions", icon: <MinusCircle className="h-3.5 w-3.5 text-rose-400" /> },
];

export const PresenceStatus = () => {
  const { socket } = useSocket();
  const [status, setStatus] = useState<Exclude<PresenceStatusType, "offline">>("online");
  const selected = statusOptions.find((option) => option.value === status) || statusOptions[0];

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleOwnPresence = ({ status: nextStatus }: { status: PresenceStatusType }) => {
      if (nextStatus !== "offline") {
        setStatus(nextStatus);
      }
    };

    socket.on("presence:self", handleOwnPresence);

    return () => {
      socket.off("presence:self", handleOwnPresence);
    };
  }, [socket]);

  const updateStatus = (nextStatus: Exclude<PresenceStatusType, "offline">) => {
    setStatus(nextStatus);
    socket?.emit("presence:set-status", nextStatus);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Availability: ${selected.label}`}
          className="flex w-auto items-center gap-2 rounded-full border border-border/70 bg-surface/70 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-surface-hover hover:text-foreground"
        >
          {selected.icon}
          <span>{selected.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56 rounded-xl border-border bg-card p-1 text-foreground shadow-xl">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => updateStatus(option.value)}
            className="cursor-pointer gap-2 px-2 py-2"
          >
            {option.icon}
            <span className="flex flex-1 flex-col">
              <span className="text-xs font-medium">{option.label}</span>
              <span className="text-[10px] text-zinc-500">{option.description}</span>
            </span>
            {status === option.value && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
