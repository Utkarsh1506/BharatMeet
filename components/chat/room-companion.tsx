"use client";

import { ArrowUpRight, CalendarClock, HelpCircle, Headphones, Plus, Sparkles, Users } from "lucide-react";
import { MemberRole, Server } from "@prisma/client";
import { useRouter } from "next/navigation";

import { UserAvatar } from "@/components/user-avatar";
import { useModal } from "@/hooks/use-modal-store";

type RoomMember = {
  id: string;
  role: MemberRole;
  profile: {
    id: string;
    name: string;
    imageUrl: string;
    presenceStatus: string;
  };
};

export const RoomCompanion = ({
  roomName,
  members,
  server,
  voiceChannelId,
}: {
  roomName: string;
  members: RoomMember[];
  server: Server;
  voiceChannelId?: string;
}) => {
  const { onOpen } = useModal();
  const router = useRouter();
  const online = members.filter((member) => member.profile.presenceStatus === "online");

  return (
    <aside className="room-companion hidden h-full w-[276px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/70 px-4 py-5 xl:!flex">
      <section className="room-focus-card shrink-0 overflow-hidden rounded-[24px] border border-primary/20 p-4">
        <div className="flex items-center justify-between">
          <span className="section-kicker">Room focus</span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Open
          </span>
        </div>
        <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-bold tracking-tight">{roomName}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Your team&apos;s shared space for ideas, decisions, and quick huddles.
        </p>
        <button
          type="button"
          onClick={() => onOpen("invite", { server })}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/15 transition hover:-translate-y-0.5 hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Bring someone in
        </button>
      </section>

      <section className="shrink-0 rounded-[22px] border border-border/70 bg-card/65 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> People
          </div>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{members.length}</span>
        </div>
        {online.length > 0 ? (
          <div className="mt-4 space-y-3">
            {online.slice(0, 4).map((member) => (
              <div key={member.id} className="flex min-w-0 items-center gap-2.5">
                <span className="relative shrink-0">
                  <UserAvatar src={member.profile.imageUrl} className="h-8 w-8" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{member.profile.name}</span>
                <span className="text-[10px] text-muted-foreground">Here</span>
              </div>
            ))}
            {online.length > 4 && <p className="pl-10 text-[11px] text-muted-foreground">+{online.length - 4} more here</p>}
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-surface/80 px-3 py-3 text-xs leading-5 text-muted-foreground">
            No one else is around yet. Invite a teammate to get the conversation started.
          </div>
        )}
        {members.length - online.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            {members.length - online.length} teammate{members.length - online.length === 1 ? " is" : "s are"} away
          </div>
        )}
      </section>

      <section className="shrink-0 rounded-[22px] border border-border/70 bg-card/65 p-4">
        <div className="section-kicker">Make it a moment</div>
        <button
          type="button"
          onClick={() => voiceChannelId
            ? router.push(`/servers/${server.id}/channels/${voiceChannelId}`)
            : onOpen("createChannel", { channelType: "AUDIO" })}
          className="mt-3 flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-hover"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Headphones className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Start a huddle</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{voiceChannelId ? "Join the team voice room" : "Create a voice room"}</span></span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="mt-2 flex items-center gap-3 rounded-xl p-2 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted-foreground"><CalendarClock className="h-4 w-4" /></span>
          <span className="min-w-0"><span className="block text-xs font-semibold">Keep the thread moving</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Drop an update for later</span></span>
        </div>
        <div className="mt-3 flex items-start gap-2 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground">
          <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          Every room keeps its own context, so the right people can catch up at their pace.
        </div>
      </section>
    </aside>
  );
};
