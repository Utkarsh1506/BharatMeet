"use client";

import { Member, MemberRole, Profile, Server } from "@prisma/client";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { useSocket } from "@/components/providers/socket-provider";

interface ServerMemberProps {
  member: Member & { profile: Pick<Profile, "id" | "name" | "imageUrl" | "userId"> };
  server: Server;
}

const roleIconMap = {
  [MemberRole.GUEST]: null,
  [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 ml-2 text-primary" />,
  [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 ml-2 text-primary" />
}

export const ServerMember = ({
  member,
  server
}: ServerMemberProps) => {
  const params = useParams();
  const router = useRouter();
  const { presenceByUserId } = useSocket();

  const icon = roleIconMap[member.role];
  const presenceStatus = presenceByUserId[member.profile.userId] || "offline";
  const isOnline = presenceStatus !== "offline";

  const onClick = () => {
    router.push(`/servers/${params?.serverId}/conversations/${member.id}`)
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group mb-1 flex w-full items-center gap-x-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-hover",
        params?.memberId === member.id && "bg-primary/10 text-primary ring-1 ring-primary/15"
      )}
    >
      <div className="relative shrink-0">
        <UserAvatar
          src={member.profile.imageUrl}
          className="h-8 w-8 md:h-8 md:w-8"
        />
        <span
          aria-label={isOnline ? "Online" : "Offline"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel",
            presenceStatus === "online" && "bg-emerald-400",
            presenceStatus === "away" && "bg-amber-400",
            presenceStatus === "dnd" && "bg-rose-400",
            presenceStatus === "offline" && "bg-zinc-500",
          )}
        />
      </div>
      <p
        className={cn(
          "text-sm font-medium transition-colors",
          params?.memberId === member.id ? "text-primary" : "text-foreground/75 group-hover:text-foreground"
        )}
      >
        {member.profile.name}
      </p>
      {icon}
    </button>
  )
}
