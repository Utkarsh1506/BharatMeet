import { Hash, MessageCircle, Video } from "lucide-react";

import { MobileToggle } from "@/components/mobile-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { SocketIndicator } from "@/components/socket-indicator";
import { PresenceIndicator } from "@/components/presence-indicator";

import { ChatVideoButton } from "./chat-video-button";

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: "channel" | "conversation";
  imageUrl?: string;
  profileId?: string;
}

export const ChatHeader = ({
  serverId,
  name,
  type,
  imageUrl,
  profileId,
}: ChatHeaderProps) => {
  return (
    <header className="flex h-14 items-center gap-2.5 border-b border-white/5 bg-surface-hover/95 px-3 backdrop-blur-sm md:px-5">
      <MobileToggle serverId={serverId} />

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-surface-hover text-zinc-200">
        {type === "channel" ? <Hash className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
      </div>

      {type === "conversation" && (
        <UserAvatar 
          src={imageUrl}
          className="-ml-1 h-8 w-8 md:h-8 md:w-8"
        />
      )}

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{name}</p>
        {type === "conversation" && profileId ? (
          <p className="hidden text-[11px] font-medium text-zinc-400 sm:block">
            <PresenceIndicator profileId={profileId} compact />
          </p>
        ) : (
          <p className="section-kicker hidden sm:block">
            Team meeting room
          </p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {type === "conversation" && (
          <ChatVideoButton />
        )}
        <SocketIndicator />
      </div>
    </header>
  )
}