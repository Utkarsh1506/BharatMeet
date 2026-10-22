"use client";

import axios from "axios";
import { Member, MeetingMode, Profile } from "@prisma/client";
import { Check, Circle, ClipboardCheck, Languages, ListChecks, Loader2, MessageCircle, Mic, MicOff, Plus, Send, Sparkles, Target, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DataPacket_Kind, RoomEvent, type Participant } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";

type RoomMember = { id: string; profile: Pick<Profile, "id" | "name" | "imageUrl"> };
type Workspace = {
  id: string;
  mode: MeetingMode;
  agenda: Array<{ id: string; title: string; completed: boolean }>;
  decisions: Array<{ id: string; summary: string; createdAt: string; author: { name: string } }>;
  actions: Array<{ id: string; title: string; completed: boolean; dueAt: string | null; assignee: { id: string; name: string } | null }>;
};
type Caption = { id: string; name: string; text: string; final: boolean };
type Tab = "agenda" | "outcomes" | "captions" | "chat";

const modes: Array<{ id: MeetingMode; label: string; description: string }> = [
  { id: "DECISION", label: "Decision", description: "Clarify options and leave with a call" },
  { id: "STANDUP", label: "Stand-up", description: "Share progress, priorities, and blockers" },
  { id: "FOCUS", label: "Focus", description: "Make room for deep, uninterrupted work" },
  { id: "WORKSHOP", label: "Workshop", description: "Build ideas together and capture next steps" },
];

const tabItems: Array<{ id: Tab; label: string; icon: typeof ListChecks }> = [
  { id: "agenda", label: "Plan", icon: ListChecks },
  { id: "outcomes", label: "Outcomes", icon: ClipboardCheck },
  { id: "captions", label: "Captions", icon: Languages },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

export const MeetingWorkspacePanel = ({
  channelId,
  serverId,
  channelName,
  member,
  members,
}: {
  channelId: string;
  serverId: string;
  channelName: string;
  member: Member;
  members: RoomMember[];
}) => {
  const room = useRoomContext();
  const [tab, setTab] = useState<Tab>("agenda");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [error, setError] = useState("");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [captionLanguage, setCaptionLanguage] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [captionSupport, setCaptionSupport] = useState(true);
  const [publishingRecap, setPublishingRecap] = useState(false);
  const recognition = useRef<any>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/meeting-spaces/${channelId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Meeting notes are unavailable right now.");
        return response.json();
      })
      .then((data) => { if (active) setWorkspace(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load meeting notes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId]);

  const update = async (data: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/meeting-spaces/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || result?.error || "Could not save this update.");
      setWorkspace(result);
      setDraft("");
      setSelectedAssignee("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this update.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: Participant, _kind?: DataPacket_Kind, topic?: string) => {
      if (topic !== "bharatmeet-caption" || payload.byteLength > 1600) return;
      try {
        const decoded = JSON.parse(new TextDecoder().decode(payload)) as { text?: unknown; final?: unknown };
        if (typeof decoded.text !== "string" || !decoded.text.trim() || decoded.text.length > 300) return;
        setCaptions((items) => [...items.slice(-9), {
          id: crypto.randomUUID(),
          name: participant?.name || participant?.identity || "Teammate",
          text: decoded.text as string,
          final: decoded.final === true,
        }]);
      } catch {
        // Ignore data packets that are not valid caption messages.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  useEffect(() => () => {
    recognition.current?.stop?.();
  }, []);

  const stopCaptions = () => {
    recognition.current?.stop?.();
    recognition.current = null;
    setListening(false);
  };

  const startCaptions = () => {
    const speechWindow = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setCaptionSupport(false);
      return;
    }
    const engine = new Recognition();
    engine.lang = captionLanguage;
    engine.continuous = true;
    engine.interimResults = true;
    engine.onresult = (event: any) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = String(result[0]?.transcript || "").trim().slice(0, 300);
        if (!text) continue;
        if (result.isFinal) {
          const caption = { id: crypto.randomUUID(), name: room.localParticipant.name || "You", text, final: true };
          setCaptions((items) => [...items.slice(-9), caption]);
          void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ text, final: true })), DataPacket_Kind.RELIABLE, { topic: "bharatmeet-caption" });
        } else interim = text;
      }
      if (interim) setCaptions((items) => [...items.filter((item) => item.final).slice(-8), { id: "interim", name: room.localParticipant.name || "You", text: interim, final: false }]);
    };
    engine.onerror = () => { recognition.current = null; setListening(false); setError("Live captions stopped. Check microphone access and try again."); };
    engine.onend = () => {
      if (recognition.current === engine) {
        try { engine.start(); } catch { setListening(false); }
      } else setListening(false);
    };
    recognition.current = engine;
    setCaptionSupport(true);
    setListening(true);
    engine.start();
  };

  const publishRecap = async () => {
    if (!workspace) return;
    setPublishingRecap(true);
    setError("");
    const recap = [
      `MEETING RECAP · ${channelName}`,
      `Format: ${modes.find((mode) => mode.id === workspace.mode)?.label || workspace.mode}`,
      "",
      "AGENDA",
      ...(workspace.agenda.slice(0, 20).map((item) => `${item.completed ? "✓" : "○"} ${item.title}`)),
      "",
      "DECISIONS",
      ...(workspace.decisions.slice(0, 15).reverse().map((decision) => `• ${decision.summary} — ${decision.author.name}`)),
      "",
      "NEXT STEPS",
      ...(workspace.actions.slice(0, 20).map((action) => `• ${action.completed ? "Done: " : ""}${action.title}${action.assignee ? ` — ${action.assignee.name}` : " — Unassigned"}${action.dueAt ? ` · due ${new Date(action.dueAt).toLocaleDateString()}` : ""}`)),
    ].join("\n").slice(0, 3900);
    try {
      await axios.post(`/api/socket/messages?channelId=${encodeURIComponent(channelId)}&serverId=${encodeURIComponent(serverId)}`, { content: recap });
      setTab("chat");
    } catch {
      setError("The recap could not be posted. Please try again.");
    } finally {
      setPublishingRecap(false);
    }
  };

  const completedAgenda = workspace?.agenda.filter((item) => item.completed).length ?? 0;
  const pendingActions = workspace?.actions.filter((item) => !item.completed).length ?? 0;

  return (
    <aside className="meeting-tools-panel">
      <div className="meeting-tools-heading">
        <div className="meeting-tools-title"><span className="meeting-tools-icon"><Sparkles className="h-4 w-4" /></span><div><p>Meeting workspace</p><span>Make the room count</span></div></div>
        {workspace && <span className="meeting-mode-badge">{workspace.mode.toLowerCase()}</span>}
      </div>
      <div className="meeting-mode-select">
        <label htmlFor="meeting-mode">Room format</label>
        <select id="meeting-mode" disabled={saving || !workspace} value={workspace?.mode || "FOCUS"} onChange={(event) => void update({ action: "mode", mode: event.target.value })}>
          {modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
        </select>
        <p>{modes.find((mode) => mode.id === workspace?.mode)?.description || "Set an intention for this room."}</p>
      </div>
      <nav className="meeting-tools-tabs" aria-label="Meeting tools">
        {tabItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setError(""); }} className={tab === id ? "is-active" : ""} aria-pressed={tab === id} title={label}><Icon className="h-4 w-4" /><span>{label}</span>{id === "outcomes" && pendingActions > 0 && <small>{pendingActions}</small>}</button>)}
      </nav>
      {error && <div className="meeting-tools-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button></div>}
      <div className="meeting-tools-content" key={tab}>
        {loading && <div className="meeting-tools-loading"><Loader2 className="h-4 w-4 animate-spin" /> Loading room notes…</div>}
        {!loading && tab === "agenda" && workspace && <>
          <div className="meeting-panel-intro"><span className="section-kicker">TODAY&apos;S PLAN</span><span>{completedAgenda}/{workspace.agenda.length} done</span></div>
          {workspace.agenda.length ? <div className="meeting-agenda-list">{workspace.agenda.map((item) => <button key={item.id} type="button" disabled={saving} onClick={() => void update({ action: "agenda-toggle", id: item.id })} className={`meeting-agenda-item ${item.completed ? "is-complete" : ""}`}><span>{item.completed ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</span><span>{item.title}</span></button>)}</div> : <p className="meeting-empty-note">Add the first thing your team should leave this room having covered.</p>}
          <form className="meeting-inline-form" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void update({ action: "agenda-add", title: draft }); }}><input value={draft} maxLength={180} onChange={(event) => setDraft(event.target.value)} placeholder="Add an agenda point" aria-label="Agenda point" /><button type="submit" disabled={saving || !draft.trim()} aria-label="Add agenda point"><Plus className="h-4 w-4" /></button></form>
          <div className="meeting-idea-card"><Target className="h-4 w-4" /><span>Start with the outcome you need. Keep the room focused on moving it forward.</span></div>
        </>}
        {!loading && tab === "outcomes" && workspace && <>
          <div className="meeting-panel-intro"><span className="section-kicker">DECISIONS</span><span>{workspace.decisions.length} captured</span></div>
          {workspace.decisions.map((decision) => <article key={decision.id} className="meeting-outcome-card"><span className="meeting-outcome-mark">✓</span><div><p>{decision.summary}</p><small>{decision.author.name}</small></div></article>)}
          {!workspace.decisions.length && <p className="meeting-empty-note">Capture a decision while everyone is in the room.</p>}
          <form className="meeting-inline-form" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void update({ action: "decision-add", summary: draft }); }}><input value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="What did the team decide?" aria-label="Decision summary" /><button type="submit" disabled={saving || !draft.trim()} aria-label="Save decision"><Plus className="h-4 w-4" /></button></form>
          <div className="meeting-panel-intro mt-5"><span className="section-kicker">FOLLOW-UPS</span><span>{pendingActions} open</span></div>
          <div className="meeting-agenda-list">{workspace.actions.map((action) => <div key={action.id} className={`meeting-task-row ${action.completed ? "is-complete" : ""}`}><button type="button" disabled={saving} onClick={() => void update({ action: "task-toggle", id: action.id })} aria-label={action.completed ? "Reopen task" : "Complete task"}>{action.completed ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</button><div><p>{action.title}</p><small>{action.assignee?.name || "Unassigned"}{action.dueAt ? ` · ${new Date(action.dueAt).toLocaleDateString()}` : ""}</small></div></div>)}</div>
          <form className="meeting-task-form" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void update({ action: "task-add", title: draft, assigneeProfileId: selectedAssignee || null }); }}><input value={draft} maxLength={240} onChange={(event) => setDraft(event.target.value)} placeholder="Add a follow-up" aria-label="Follow-up task" /><select value={selectedAssignee} onChange={(event) => setSelectedAssignee(event.target.value)} aria-label="Assign follow-up"><option value="">Owner</option>{members.map((roomMember) => <option key={roomMember.profile.id} value={roomMember.profile.id}>{roomMember.profile.name}</option>)}</select><button type="submit" disabled={saving || !draft.trim()} aria-label="Add follow-up"><Plus className="h-4 w-4" /></button></form>
          <button type="button" className="meeting-recap-button" disabled={publishingRecap || (!workspace.agenda.length && !workspace.decisions.length && !workspace.actions.length)} onClick={() => void publishRecap()}>{publishingRecap ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post recap to room chat</button>
        </>}
        {!loading && tab === "captions" && <>
          <div className="meeting-panel-intro"><span className="section-kicker">LIVE CAPTIONS</span><span className="meeting-caption-language"><Languages className="h-3.5 w-3.5" /><select value={captionLanguage} onChange={(event) => setCaptionLanguage(event.target.value)} aria-label="Caption language" disabled={listening}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option></select></span></div>
          <p className="meeting-caption-hint">Choose English or Hindi speech recognition. Captions you share are visible to everyone in this room.</p>
          {!captionSupport && <p className="meeting-empty-note">Live captions need Chrome or Edge speech recognition. You can still use the agenda, outcomes, and room chat here.</p>}
          <button type="button" className={`meeting-caption-toggle ${listening ? "is-listening" : ""}`} onClick={listening ? stopCaptions : startCaptions}>{listening ? <><MicOff className="h-4 w-4" /> Stop captions</> : <><Mic className="h-4 w-4" /> Start live captions</>}</button>
          <div className="meeting-caption-list" aria-live="polite">{captions.slice(-8).map((caption) => <div key={caption.id} className={caption.final ? "" : "is-interim"}><small>{caption.name}</small><p>{caption.text}</p></div>)}{!captions.length && <p className="meeting-empty-note">Captions will appear here as people speak.</p>}</div>
        </>}
        {!loading && tab === "chat" && <div className="meeting-inroom-chat"><ChatMessages member={member} name={channelName} chatId={channelId} type="channel" apiUrl="/api/messages" socketUrl="/api/socket/messages" socketQuery={{ channelId, serverId }} paramKey="channelId" paramValue={channelId} /><ChatInput name={channelName} type="channel" apiUrl="/api/socket/messages" query={{ channelId, serverId }} /></div>}
      </div>
    </aside>
  );
};
