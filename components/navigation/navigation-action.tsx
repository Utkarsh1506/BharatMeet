"use client";

import { Plus } from "lucide-react";

import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";

export const NavigationAction = () => {
  const { onOpen } = useModal();

  return (
    <div>
      <ActionTooltip
        side="right"
        align="center"
        label="Create Sabha"
      >
        <button
          onClick={() => onOpen("createServer")}
          className="group flex items-center focus-visible:outline-none"
          aria-label="Create Sabha"
        >
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-surface text-primary shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-sidebar">
            <Plus
              className="transition"
              size={25}
            />
          </div>
        </button>
      </ActionTooltip>
    </div>
  )
}
