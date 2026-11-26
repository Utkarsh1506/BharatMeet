"use client";

import { ArrowUpRight, CalendarClock, HelpCircle, Headphones, Plus, Sparkles, Users } from "lucide-react";
import { MemberRole, Server } from "@prisma/client";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { useModal } from "@/hooks/use-modal-store";
import { openReminder } from "@/lib/reminder-events";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OPEN_TEAM_PULSE_EVENT } from "@/lib/team-pulse-events";
import { TeamCatchUp } from "@/components/chat/team-catch-up";

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
  channelId,
  voiceChannelId,
}: {
  roomName: string;
  members: RoomMember[];
  server: Server;
  channelId: string;
  voiceChannelId?: string;
}) => {
  const { onOpen } = useModal();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pulseOpen, setPulseOpen] = useState(false);
  const [pulseDone, setPulseDone] = useState("");
  const [pulseNext, setPulseNext] = useState("");
  const [pulseBlocked, setPulseBlocked] = useState("");
  const [pulseBusy, setPulseBusy] = useState(false);
  const [pulseError, setPulseError] = useState("");
  const online = members.filter((member) => member.profile.presenceStatus === "online");

  useEffect(() => {
    const openPulse = () => {
      setPulseError("");
      setPulseOpen(true);
    };
    window.addEventListener(OPEN_TEAM_PULSE_EVENT, openPulse);
    return () => window.removeEventListener(OPEN_TEAM_PULSE_EVENT, openPulse);
  }, []);

  const submitPulse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pulseDone.trim() && !pulseNext.trim() && !pulseBlocked.trim()) {
      setPulseError("Add at least one update before sharing your pulse.");
      return;
    }

    setPulseBusy(true);
    setPulseError("");
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date());
    const content = [
      `TEAM PULSE · ${dateLabel}`,
      `✅ Done: ${pulseDone.trim() || "—"}`,
      `🎯 Next: ${pulseNext.trim() || "—"}`,
      `🧱 Blocked: ${pulseBlocked.trim() || "None"}`,
    ].join("\n");

    try {
      await axios.post(
        `/api/messages?channelId=${encodeURIComponent(channelId)}&serverId=${encodeURIComponent(server.id)}`,
        { content },
      );
      await queryClient.invalidateQueries({ queryKey: [`chat:${channelId}`], exact: true });
      setPulseDone("");
      setPulseNext("");
      setPulseBlocked("");
      setPulseOpen(false);
    } catch (error) {
      const responseData = axios.isAxiosError(error) ? error.response?.data : null;
      const message = responseData && typeof responseData === "object"
        ? (responseData as { error?: string | { message?: string } }).error
        : null;
      setPulseError(typeof message === "string" ? message : message?.message || "Could not share your update. Please try again.");
    } finally {
      setPulseBusy(false);
    }
  };

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
          onClick={() => { setPulseError(""); setPulseOpen(true); }}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.06] p-2 text-left transition hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Share a team pulse</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Done · next · blockers</span></span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <TeamCatchUp serverId={server.id} channelId={channelId} members={members} />
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
        <button
          type="button"
          onClick={() => {
            const url = new URL(window.location.href);
            openReminder({
              title: `Follow up in ${roomName}`.slice(0, 160),
              link: `${url.pathname}${url.search}`,
            });
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted-foreground"><CalendarClock className="h-4 w-4" /></span>
          <span className="min-w-0"><span className="block text-xs font-semibold">Set a room follow-up</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Get reminded to return here</span></span>
          <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
        <div className="mt-3 flex items-start gap-2 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground">
          <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          Every room keeps its own context, so the right people can catch up at their pace.
        </div>
      </section>

      <Dialog open={pulseOpen} onOpenChange={(nextOpen) => {
        setPulseOpen(nextOpen);
        if (!nextOpen) setPulseError("");
      }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.25rem)] max-w-lg overflow-y-auto rounded-2xl border-border bg-card text-card-foreground sm:w-full">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Share your team pulse</DialogTitle>
            <DialogDescription>Keep everyone in sync without scheduling another call. Share only what is useful today.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPulse} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              <span>What did you finish?</span>
              <textarea value={pulseDone} onChange={(event) => setPulseDone(event.target.value)} maxLength={900} rows={3} placeholder="A win, decision, or piece of progress…" className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal leading-5 outline-none transition placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>What are you focusing on next?</span>
              <textarea value={pulseNext} onChange={(event) => setPulseNext(event.target.value)} maxLength={900} rows={3} placeholder="The next thing you want to move forward…" className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal leading-5 outline-none transition placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Anything blocking you?</span>
              <textarea value={pulseBlocked} onChange={(event) => setPulseBlocked(event.target.value)} maxLength={900} rows={2} placeholder="Leave blank if nothing is blocked…" className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal leading-5 outline-none transition placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary" />
            </label>
            {pulseError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{pulseError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={pulseBusy} onClick={() => setPulseOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pulseBusy || (!pulseDone.trim() && !pulseNext.trim() && !pulseBlocked.trim())}>
                {pulseBusy ? "Sharing…" : "Share update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
};
