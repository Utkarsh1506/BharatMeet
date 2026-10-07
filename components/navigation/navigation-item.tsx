"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";

interface NavigationItemProps {
  id: string;
  imageUrl: string;
  name: string;
};

export const NavigationItem = ({
  id,
  imageUrl,
  name
}: NavigationItemProps) => {
  const router = useRouter();

  const onClick = () => {
    router.push(`/servers/${id}`);
  }

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
          "absolute left-0 w-[4px] rounded-r-full bg-gradient-to-b from-indigo-400 to-cyan-400 transition-all",
          "h-[8px] group-hover:h-[20px]"
        )} />
        <div className={cn(
          "relative mx-3 flex h-[48px] w-[48px] overflow-hidden rounded-md border border-white/10 transition-all duration-200 group-hover:border-indigo-300/70 group-hover:bg-indigo-500/10"
        )}>
          <Image
            fill
            src={imageUrl}
            alt={name}
            className="object-cover"
          />
        </div>
      </button>
    </ActionTooltip>
  )
}