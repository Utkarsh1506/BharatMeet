import { Hash, ListTodo, MessageCircle, Sparkles } from "lucide-react";

import { MobileToggle } from "@/components/mobile-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { SocketIndicator } from "@/components/socket-indicator";
import { PresenceIndicator } from "@/components/presence-indicator";

import { ChatVideoButton } from "./chat-video-button";
import { DesktopSidebarToggle } from "@/components/navigation/desktop-sidebar-toggle";
import { openTeamCatchUp, openTeamPulse } from "@/lib/team-pulse-events";

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: "channel" | "conversation";
  imageUrl?: string;
  profileId?: string;
  channelId?: string;
}

export const ChatHeader = ({
  serverId,
  name,
  type,
  imageUrl,
  profileId,
  channelId,
}: ChatHeaderProps) => {
  return (
    <header className="relative z-10 flex h-[78px] shrink-0 items-center gap-3 border-b border-border/70 bg-panel/90 px-3 backdrop-blur-xl md:px-6">
      <MobileToggle serverId={serverId} />

      <DesktopSidebarToggle />

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner">
        {type === "channel" ? <Hash className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
      </div>

      {type === "conversation" && (
        <UserAvatar 
          src={imageUrl}
          className="-ml-1 h-8 w-8 md:h-8 md:w-8"
        />
      )}

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-bold tracking-tight text-foreground">{name}</p>
          {type === "channel" && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">Room</span>}
        </div>
        {type === "conversation" && profileId ? (
          <p className="hidden text-[11px] font-medium text-muted-foreground sm:!block">
            <PresenceIndicator profileId={profileId} compact />
          </p>
        ) : (
          <p className="section-kicker hidden sm:!block">
            <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> A place to make progress together
          </p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {type === "channel" && channelId && (
          <>
            <button
              type="button"
              onClick={openTeamCatchUp}
              aria-label="Open team catch-up"
              title="Team catch-up"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-xs font-semibold text-foreground transition hover:border-primary/25 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden"
            >
              <ListTodo className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Catch-up</span>
            </button>
            <button
              type="button"
              onClick={openTeamPulse}
              aria-label="Share a team pulse"
              title="Share a team pulse"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Pulse</span>
            </button>
          </>
        )}
        {type === "conversation" && (
          <ChatVideoButton />
        )}
        <SocketIndicator />
      </div>
    </header>
  )
}
