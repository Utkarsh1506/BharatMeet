"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, ArrowUpRight, Check, Circle, Clock3, Heart, ListTodo, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPEN_TEAM_CATCHUP_EVENT } from "@/lib/team-pulse-events";

type Status = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
type CatchUpData = {
  currentProfileId: string;
  pulses: Array<{
    id: string;
    pulseId: string | null;
    content: string;
    createdAt: string;
    channel: { id: string; name: string };
    member: { profile: { id: string; name: string; imageUrl: string } };
    actionItems: Array<{ id: string; title: string; status: Status }>;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    status: Status;
    dueAt: string | null;
    createdAt: string;
    channel: { id: string; name: string };
    sourceMessageId: string | null;
    sourcePulseId: string | null;
    assignee: { id: string; name: string } | null;
  }>;
};
type TeamMember = { profile: { id: string; name: string } };
type Appreciation = { id: string; message: string; createdAt: string; channel: { id: string; name: string }; sender: { id: string; name: string }; recipient: { id: string; name: string } };

function pulseValue(content: string, label: string) {
  return content.split("\n").find((line) => line.startsWith(`${label}:`))?.slice(label.length + 1).trim() || "";
}

function readableDate(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function TeamCatchUp({ serverId, channelId, members }: { serverId: string; channelId: string; members: TeamMember[] }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CatchUpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourcePulse, setSourcePulse] = useState<CatchUpData["pulses"][number] | null>(null);
  const [title, setTitle] = useState("");
  const [assigneeProfileId, setAssigneeProfileId] = useState("me");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [helpBusyPulseId, setHelpBusyPulseId] = useState("");
  const [appreciations, setAppreciations] = useState<Appreciation[]>([]);
  const [showAppreciationForm, setShowAppreciationForm] = useState(false);
  const [recipientProfileId, setRecipientProfileId] = useState("");
  const [appreciationMessage, setAppreciationMessage] = useState("");
  const [appreciationBusy, setAppreciationBusy] = useState(false);
  const [appreciationError, setAppreciationError] = useState("");

  const loadCatchUp = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/action-items?serverId=${encodeURIComponent(serverId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || result?.error || "Could not load team catch-up.");
      setData(result as CatchUpData);
      const appreciationResponse = await fetch(`/api/appreciations?serverId=${encodeURIComponent(serverId)}`, { cache: "no-store" });
      if (appreciationResponse.ok) {
        const appreciationResult = await appreciationResponse.json();
        setAppreciations(appreciationResult.appreciations as Appreciation[]);
        setAppreciationError("");
      } else {
        setAppreciationError("Appreciation moments could not be loaded right now.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load team catch-up.");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (open) void loadCatchUp();
  }, [open, loadCatchUp]);

  useEffect(() => {
    const openCatchUp = () => setOpen(true);
    window.addEventListener(OPEN_TEAM_CATCHUP_EVENT, openCatchUp);
    return () => window.removeEventListener(OPEN_TEAM_CATCHUP_EVENT, openCatchUp);
  }, []);

  const memberOptions = useMemo(() => members.map(({ profile }) => profile), [members]);

  const sendAppreciation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientProfileId || appreciationMessage.trim().length < 3) return;
    setAppreciationBusy(true);
    setAppreciationError("");
    try {
      const response = await fetch("/api/appreciations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, channelId, recipientProfileId, message: appreciationMessage.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || result?.error || "Could not send your appreciation.");
      setAppreciationMessage("");
      setShowAppreciationForm(false);
      await loadCatchUp();
    } catch (caught) {
      setAppreciationError(caught instanceof Error ? caught.message : "Could not send your appreciation.");
    } finally {
      setAppreciationBusy(false);
    }
  };

  const startAction = (pulse: CatchUpData["pulses"][number]) => {
    setSourcePulse(pulse);
    setTitle(pulseValue(pulse.content, "🎯 Next") === "—" ? "" : pulseValue(pulse.content, "🎯 Next"));
    setAssigneeProfileId("me");
    setDueAt("");
    setError("");
  };

  const createAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          channelId: sourcePulse?.channel.id || channelId,
          sourceMessageId: sourcePulse?.pulseId ? null : sourcePulse?.id || null,
          sourcePulseId: sourcePulse?.pulseId || null,
          title: title.trim(),
          assigneeProfileId: assigneeProfileId === "me" ? data?.currentProfileId : assigneeProfileId,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || result?.error || "Could not create the action.");
      setSourcePulse(null);
      setTitle("");
      setDueAt("");
      await loadCatchUp();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the action.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (actionItemId: string, status: Status) => {
    setUpdatingId(actionItemId);
    setError("");
    try {
      const response = await fetch("/api/action-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, actionItemId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || result?.error || "Could not update the action.");
      await loadCatchUp();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the action.");
    } finally {
      setUpdatingId("");
    }
  };

  const offerHelp = async (pulse: CatchUpData["pulses"][number], blocker: string) => {
    if (!pulse.pulseId || !data?.currentProfileId) return;
    setHelpBusyPulseId(pulse.id);
    setError("");
    try {
      const title = `Help with blocker: ${blocker}`.slice(0, 240);
      const response = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          channelId: pulse.channel.id,
          sourcePulseId: pulse.pulseId,
          title,
          assigneeProfileId: data.currentProfileId,
          helpForProfileId: pulse.member.profile.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || result?.error || "Could not send your offer to help.");
      await loadCatchUp();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your offer to help.");
    } finally {
      setHelpBusyPulseId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) { setSourcePulse(null); setError(""); } }}>
      <DialogTrigger asChild>
        <button type="button" className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border/60 p-2 text-left transition hover:border-primary/25 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-primary"><ListTodo className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Team catch-up</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Updates, blockers & next steps</span></span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.25rem)] max-w-2xl overflow-y-auto rounded-2xl border-border bg-card text-card-foreground sm:w-full">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Team catch-up</DialogTitle>
          <DialogDescription>Recent pulse updates and follow-through for the last 7 days. Turn a next step into an owned action.</DialogDescription>
        </DialogHeader>

        {sourcePulse && (
          <form onSubmit={createAction} className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.05] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold">Make this a team action</p><p className="mt-0.5 text-xs text-muted-foreground">From {sourcePulse.member.profile.name}&apos;s pulse in #{sourcePulse.channel.name}</p></div>
              <button type="button" aria-label="Cancel action creation" className="rounded-md p-1 text-muted-foreground hover:bg-surface" onClick={() => setSourcePulse(null)}>×</button>
            </div>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required placeholder="What needs to happen next?" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Select value={assigneeProfileId} onValueChange={setAssigneeProfileId}>
                <SelectTrigger aria-label="Action owner"><SelectValue placeholder="Choose an owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Me</SelectItem>
                  {memberOptions.filter((member) => member.id !== data?.currentProfileId).map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <input aria-label="Optional due date" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              <Button type="submit" disabled={saving || !title.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Create action</Button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Open actions <span className="ml-1 text-xs font-normal text-muted-foreground">{data?.actionItems.length ?? 0}</span></h3><Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void loadCatchUp()}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button></div>
          {loading && !data ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading team context…</div> : data?.actionItems.length ? (
            <div className="space-y-2">
              {data.actionItems.map((action) => (
                <article key={action.id} className={`rounded-xl border p-3 ${action.status === "BLOCKED" ? "border-amber-500/30 bg-amber-500/[0.05]" : "border-border/70 bg-background/50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${action.status === "BLOCKED" ? "bg-amber-400" : action.status === "IN_PROGRESS" ? "bg-sky-400" : "bg-primary"}`} /><p className="break-words text-sm font-medium">{action.title}</p></div><p className="mt-1 pl-4 text-[11px] text-muted-foreground">#{action.channel.name} · {action.assignee ? `Owner: ${action.assignee.name}` : "Unassigned"}{action.dueAt ? ` · Due ${readableDate(action.dueAt)}` : ""}</p></div>
                    <Select value={action.status} disabled={updatingId === action.id} onValueChange={(status) => void updateStatus(action.id, status as Status)}>
                      <SelectTrigger aria-label={`Update status for ${action.title}`} className="h-8 w-[138px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="BLOCKED">Blocked</SelectItem><SelectItem value="DONE">Done</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {(action.sourceMessageId || action.sourcePulseId) && <Link href={`/servers/${serverId}/channels/${action.channel.id}`} onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-1 pl-4 text-[11px] font-medium text-primary hover:underline">View source room <ArrowUpRight className="h-3 w-3" /></Link>}
                </article>
              ))}
            </div>
          ) : <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center"><Circle className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No open actions</p><p className="mt-1 text-xs text-muted-foreground">Turn a teammate&apos;s next step into a clear owner and follow-up.</p></div>}
        </section>

        <section className="space-y-3 border-t border-border/70 pt-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Recent pulses <span className="ml-1 text-xs font-normal text-muted-foreground">last 7 days</span></h3><span className="text-[11px] text-muted-foreground">{data?.pulses.length ?? 0} updates</span></div>
          {data?.pulses.length ? data.pulses.map((pulse) => {
            const done = pulseValue(pulse.content, "✅ Done");
            const next = pulseValue(pulse.content, "🎯 Next");
            const blocked = pulseValue(pulse.content, "🧱 Blocked");
            const hasBlocker = blocked && blocked !== "None" && blocked !== "—";
            return <article key={pulse.id} className={`rounded-xl border p-3 ${hasBlocker ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-border/70 bg-background/40"}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold">{pulse.member.profile.name}<span className="ml-2 font-normal text-muted-foreground">#{pulse.channel.name} · {readableDate(pulse.createdAt)}</span></p><p className="mt-2 text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">Done:</span> {done || "—"}<br /><span className="font-medium text-foreground">Next:</span> {next || "—"}<br /><span className={hasBlocker ? "font-medium text-amber-500" : "font-medium text-foreground"}>Blocked:</span> {blocked || "None"}</p></div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" disabled={!next || next === "—" || pulse.actionItems.some((item) => item.status !== "DONE" && item.title === next)} onClick={() => startAction(pulse)}><ListTodo className="mr-1.5 h-3.5 w-3.5" /> Make action</Button>
                  {hasBlocker && pulse.pulseId && pulse.member.profile.id !== data?.currentProfileId && (() => {
                    const offered = pulse.actionItems.some((item) => item.status !== "DONE" && item.title.startsWith("Help with blocker:"));
                    return <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-amber-500 hover:text-amber-400" disabled={offered || helpBusyPulseId === pulse.id} onClick={() => void offerHelp(pulse, blocked)}>{helpBusyPulseId === pulse.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Heart className="mr-1.5 h-3.5 w-3.5" />}{offered ? "Help offered" : "I can help"}</Button>;
                  })()}
                </div>
              </div>
              {pulse.actionItems.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" />{pulse.actionItems.length} linked follow-up{pulse.actionItems.length === 1 ? "" : "s"}</p>}
            </article>;
          }) : !loading && <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center"><AlertCircle className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No recent pulses yet</p><p className="mt-1 text-xs text-muted-foreground">Share a Done · Next · Blocked update to start the team loop.</p></div>}
        </section>

        <section className="space-y-3 border-t border-border/70 pt-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-1.5 text-sm font-semibold"><Heart className="h-4 w-4 text-rose-400" /> Small wins, shared</h3><p className="mt-1 text-[11px] text-muted-foreground">A thoughtful thank-you, without scores or streaks.</p></div><Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setShowAppreciationForm((current) => !current); setAppreciationError(""); if (!recipientProfileId) setRecipientProfileId(memberOptions.find((member) => member.id !== data?.currentProfileId)?.id || ""); }}><Heart className="mr-1.5 h-3.5 w-3.5" /> Thank someone</Button></div>
          {showAppreciationForm && <form onSubmit={sendAppreciation} className="space-y-2.5 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-3">
            <Select value={recipientProfileId} onValueChange={setRecipientProfileId}>
              <SelectTrigger aria-label="Choose teammate to appreciate"><SelectValue placeholder="Choose a teammate" /></SelectTrigger>
              <SelectContent>{memberOptions.filter((member) => member.id !== data?.currentProfileId).map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
            </Select>
            <textarea value={appreciationMessage} onChange={(event) => setAppreciationMessage(event.target.value)} maxLength={300} minLength={3} rows={2} required placeholder="What did they do that helped? Be specific…" className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-muted-foreground">Up to 5 notes a day · only for workspace teammates</span><Button type="submit" size="sm" disabled={appreciationBusy || !recipientProfileId || appreciationMessage.trim().length < 3}>{appreciationBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />} Send thanks</Button></div>
          </form>}
          {appreciationError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{appreciationError}</p>}
          {appreciations.length ? <div className="space-y-2">{appreciations.slice(0, 5).map((moment) => <article key={moment.id} className="rounded-xl border border-border/70 bg-background/40 p-3"><p className="text-sm leading-5">“{moment.message}”</p><p className="mt-2 text-[10px] text-muted-foreground"><span className="font-medium text-foreground">{moment.sender.name}</span> thanked <span className="font-medium text-foreground">{moment.recipient.name}</span> · #{moment.channel.name} · {readableDate(moment.createdAt)}</p></article>)}</div> : !loading && <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No thank-you notes yet. A specific, sincere note can make someone&apos;s day.</p>}
        </section>
      </DialogContent>
    </Dialog>
  );
}
