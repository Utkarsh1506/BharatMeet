"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";

interface NavigationItemProps {
  id: string;
  imageUrl: string;
  name: string;
  isActive?: boolean;
};

export const NavigationItem = ({
  id,
  imageUrl,
  name,
  isActive = false
}: NavigationItemProps) => {
  const router = useRouter();

  const onClick = () => {
    router.push(`/servers/${id}`);
  };

  return (
    <ActionTooltip
      side="right"
      align="center"
      label={name}
    >
      <button
        onClick={onClick}
        className="group relative flex items-center"
      >
        <div className={cn(
          "absolute -left-2 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-amber-300 transition-all",
          isActive ? "h-7 shadow-[0_0_14px_hsl(var(--primary)/0.55)]" : "h-2 group-hover:h-6"
        )} />
        <div className={cn(
          "relative mx-3 flex h-[48px] w-[48px] overflow-hidden rounded-2xl border border-border/70 bg-surface transition-all duration-200",
          isActive
            ? "border-primary/60 bg-primary/15 shadow-[0_8px_24px_hsl(var(--primary)/0.16)]"
            : "group-hover:rounded-xl group-hover:border-primary/35 group-hover:bg-primary/10"
        )}>
          {imageUrl ? (
            <Image
              fill
              src={imageUrl}
              alt={name}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-primary/10">
              <span className="text-[0.62rem] font-black tracking-[0.14em] text-primary">
                {name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </button>
    </ActionTooltip>
  )
}
