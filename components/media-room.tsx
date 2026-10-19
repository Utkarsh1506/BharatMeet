"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  AudioConference,
  PreJoin,
  VideoConference,
  useConnectionState,
  useParticipants,
  useRoomContext,
  type LocalUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useUser } from "@clerk/nextjs";
import { DisconnectReason, RoomEvent } from "livekit-client";
import { Member } from "@prisma/client";
import { AlertTriangle, Loader2, Radio, RefreshCw, Sparkles, Users, Video } from "lucide-react";
import { MeetingWorkspacePanel } from "@/components/meeting/meeting-workspace-panel";
import type { Profile } from "@prisma/client";

interface MediaRoomProps {
  chatId: string;
  serverId?: string;
  channelName?: string;
  member?: Member;
  members?: Array<{ id: string; profile: Pick<Profile, "id" | "name" | "imageUrl" | "presenceStatus"> }>;
  video: boolean;
  audio: boolean;
}

const MeetingTopbar = () => {
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const connected = connectionState === "connected";
  const reconnecting = connectionState === "reconnecting";

  return (
    <div className="meeting-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <div className="meeting-brand-mark"><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">BharatMeet <span className="font-medium text-white/50">/ Live room</span></p>
          <p className="mt-0.5 text-[11px] text-white/50">A focused space to meet and make progress</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="meeting-participant-count"><Users className="h-3.5 w-3.5" />{participants.length}</span>
        <span className={`meeting-connection-pill ${connected ? "is-connected" : reconnecting ? "is-reconnecting" : ""}`}>
          <span className="meeting-status-dot" />
          <span className="hidden sm:inline">{connected ? "Connected" : reconnecting ? "Reconnecting" : "Connecting"}</span>
        </span>
      </div>
    </div>
  );
};

const MeetingConnectionLifecycle = ({
  onConnected,
  onDisconnected,
}: {
  onConnected: () => void;
  onDisconnected: (reason?: DisconnectReason) => void;
}) => {
  const room = useRoomContext();

  useEffect(() => {
    const connected = () => onConnected();
    const disconnected = (reason?: DisconnectReason) => onDisconnected(reason);
    room.on(RoomEvent.Connected, connected);
    room.on(RoomEvent.Disconnected, disconnected);
    return () => {
      room.off(RoomEvent.Connected, connected);
      room.off(RoomEvent.Disconnected, disconnected);
    };
  }, [onConnected, onDisconnected, room]);

  return null;
};

export const MediaRoom = ({ chatId, serverId, channelName, member, members, video, audio }: MediaRoomProps) => {
  const { user, isLoaded } = useUser();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [joinChoices, setJoinChoices] = useState<LocalUserChoices | null>(null);
  const [mediaWarning, setMediaWarning] = useState("");
  const [preJoinKey, setPreJoinKey] = useState(0);
  const connectionFailed = useRef(false);
  const hasConnected = useRef(false);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  const displayName = user?.fullName?.trim() || user?.firstName?.trim() || user?.username || "BharatMeet guest";

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      setError("Meeting setup took too long. Check your connection and try again.");
    }, 15_000);
    setError("");
    setToken("");
    setJoinChoices(null);
    setMediaWarning("");

    const requestToken = async () => {
      try {
        const params = new URLSearchParams({ room: chatId });
        const response = await fetch(`/api/livekit?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const message = typeof data?.error === "string" ? data.error : data?.error?.message;
          throw new Error(message || `Meeting service returned ${response.status}`);
        }
        if (typeof data?.token !== "string" || data.token.length === 0) {
          throw new Error("The meeting service returned an invalid access token");
        }

        setToken(data.token);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to start the meeting session");
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void requestToken();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [chatId, retryCount]);

  const retry = () => setRetryCount((count) => count + 1);

  if (!serverUrl) {
    return (
      <MeetingMessage
        icon={<Video className="h-5 w-5" />}
        eyebrow="Meeting setup"
        title="Your meeting space is almost ready"
        description="Live meetings need a LiveKit server. Add NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to the app environment."
      />
    );
  }

  if (error) {
    return (
      <MeetingMessage
        icon={<AlertTriangle className="h-5 w-5" />}
        eyebrow="Connection interrupted"
        title="We couldn’t open this room"
        description={error}
        action={<button type="button" onClick={retry} className="meeting-primary-button"><RefreshCw className="h-4 w-4" /> Try again</button>}
        danger
      />
    );
  }

  if (!isLoaded || !user || !token) {
    return (
      <div className="meeting-stage">
        <div className="meeting-loading-card"><Loader2 className="h-5 w-5 animate-spin text-amber-300" /><span>Preparing your room…</span></div>
      </div>
    );
  }

  if (!joinChoices) {
    return (
      <section className="meeting-stage meeting-lobby" data-lk-theme="default">
        <div className="meeting-lobby-heading">
          <div className="meeting-lobby-icon"><Radio className="h-5 w-5" /></div>
          <div>
            <p className="meeting-eyebrow">YOUR SPACE IS READY</p>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Take a moment before you join</h2>
            <p className="mt-1.5 text-sm text-white/60">You’ll join as <span className="font-semibold text-white/85">{displayName}</span>. Check your camera and microphone before joining.</p>
          </div>
        </div>
        <div className="meeting-prejoin-wrap">
          <PreJoin
            key={preJoinKey}
            defaults={{
              username: displayName,
              videoEnabled: video,
              audioEnabled: audio,
            }}
            joinLabel="Join room"
            onError={(mediaError) => setMediaWarning(describeMediaError(mediaError.message))}
            onSubmit={(choices) => {
              connectionFailed.current = false;
              setMediaWarning("");
              setJoinChoices({ ...choices, username: displayName });
            }}
            className={`meeting-prejoin ${video ? "" : "audio-only"}`}
          />
        </div>
        {mediaWarning && <MediaWarning message={mediaWarning} />}
        <p className="meeting-privacy-note"><span className="meeting-status-dot" /> Your local preview stays private until you join the room.</p>
      </section>
    );
  }

  return (
    <LiveKitRoom
      className="meeting-room-shell"
      data-lk-theme="default"
      serverUrl={serverUrl}
      token={token}
      connect
      video={video && joinChoices.videoEnabled
        ? (joinChoices.videoDeviceId ? { deviceId: joinChoices.videoDeviceId } : true)
        : false}
      audio={joinChoices.audioEnabled
        ? (joinChoices.audioDeviceId ? { deviceId: joinChoices.audioDeviceId } : true)
        : false}
      options={{ adaptiveStream: true, dynacast: true }}
      onError={(roomError) => {
        if (/client initiated disconnect/i.test(roomError.message)) {
          connectionFailed.current = false;
          hasConnected.current = false;
          setJoinChoices(null);
          setToken("");
          setError("");
          return;
        }
        connectionFailed.current = true;
        setError(roomError.message || "The meeting connection failed");
      }}
      onMediaDeviceFailure={(failure) => {
        setMediaWarning(`The meeting is connected, but ${describeMediaError(String(failure || "device error")).toLowerCase()}`);
      }}
    >
      <MeetingConnectionLifecycle
        onConnected={() => { hasConnected.current = true; }}
        onDisconnected={(reason) => {
          if (connectionFailed.current) return;
          if (reason === DisconnectReason.CLIENT_INITIATED || (!reason && hasConnected.current)) {
            hasConnected.current = false;
            setJoinChoices(null);
            setToken("");
            setRetryCount((count) => count + 1);
            return;
          }

          connectionFailed.current = true;
          const reasonMessage = reason === DisconnectReason.DUPLICATE_IDENTITY
            ? "This account is already connected in the room from another session. Close the other meeting tab and try again."
            : reason === DisconnectReason.JOIN_FAILURE
              ? "LiveKit rejected the room join. Check the meeting server URL, credentials, and system clock."
              : `The LiveKit connection ended before the room was ready${reason ? ` (reason ${reason})` : ""}. Check your network and LiveKit configuration, then retry.`;
          setError(reasonMessage);
        }}
      />
      <MeetingTopbar />
      {mediaWarning && <MediaWarning message={mediaWarning} />}
      <div className="meeting-video-stage">
        {video ? <VideoConference className="h-full" /> : <AudioConference className="h-full" />}
        {serverId && channelName && member && members && <MeetingWorkspacePanel
          channelId={chatId}
          serverId={serverId}
          channelName={channelName}
          member={member}
          members={members}
        />}
      </div>
    </LiveKitRoom>
  );
};

const MediaWarning = ({ message }: { message: string }) => (
  <div className="meeting-media-warning" role="status">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    <span>{message}</span>
  </div>
);

const describeMediaError = (message?: string) => {
  if (/permission|denied|notallowed/i.test(message || "")) {
    return "Your browser blocked camera or microphone access. Allow access for localhost:3000 in the site settings, or switch the device off to join without it.";
  }
  if (/aborterror|timeout starting video source/i.test(message || "")) {
    return "The camera took too long to start. Close other apps using it, then choose the camera again.";
  }
  return message || "A selected camera or microphone is unavailable. Turn it off or choose another device to continue.";
};

interface MeetingMessageProps {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  danger?: boolean;
}

const MeetingMessage = ({ icon, eyebrow, title, description, action, danger = false }: MeetingMessageProps) => (
  <div className="meeting-stage px-5 py-8">
    <div className="meeting-message-card">
      <div className={`meeting-message-icon ${danger ? "is-danger" : ""}`}>{icon}</div>
      <p className="meeting-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-white/60">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  </div>
);
