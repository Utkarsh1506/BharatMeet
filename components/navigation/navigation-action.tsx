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
          <div className="mx-3 flex h-[48px] w-[48px] items-center justify-center overflow-hidden rounded-[20px] border border-white/5 bg-surface transition-all duration-200 group-hover:rounded-[16px] group-hover:bg-emerald-500/90 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-sidebar">
            <Plus
              className="text-emerald-400 transition group-hover:text-white"
              size={25}
            />
          </div>
        </button>
      </ActionTooltip>
    </div>
  )
}