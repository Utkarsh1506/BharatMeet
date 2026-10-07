"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  PreJoin,
  VideoConference,
  type LocalUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useUser } from "@clerk/nextjs";
import { AlertTriangle, Loader2, RefreshCw, Video } from "lucide-react";

interface MediaRoomProps {
  chatId: string;
  video: boolean;
  audio: boolean;
};

export const MediaRoom = ({
  chatId,
  video,
  audio
}: MediaRoomProps) => {
  const { user } = useUser();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [joinChoices, setJoinChoices] = useState<LocalUserChoices | null>(null);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const params = new URLSearchParams({ room: chatId });
        const resp = await fetch(`/api/livekit?${params.toString()}`);
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data?.error || "Unable to create meeting token");
        }

        setToken(data.token);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to start meeting session");
        console.log(e);
      }
    })()
  }, [user, chatId, retryCount]);

  if (!serverUrl) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/30 px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
          <Video className="mx-auto mb-4 h-8 w-8 text-primary" />
          <p className="text-base font-semibold text-foreground">Video meetings are not configured</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Add NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/30 px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-destructive/20 bg-card p-8 shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-destructive" />
          <p className="text-base font-semibold text-foreground">We couldn&apos;t start this meeting</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError("");
              setToken("");
              setJoinChoices(null);
              setRetryCount((count) => count + 1);
            }}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (token === "") {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/30 px-6">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Preparing your meeting room...
        </div>
      </div>
    )
  }

  if (!joinChoices) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-panel px-4 py-8">
        <PreJoin
          defaults={{
            videoEnabled: video,
            audioEnabled: audio,
          }}
          joinLabel="Join meeting"
          onSubmit={setJoinChoices}
          className="w-full max-w-2xl"
        />
      </div>
    );
  }

  return (
    <LiveKitRoom
      className="flex h-full min-h-0 w-full flex-1 flex-col"
      data-lk-theme="default"
      serverUrl={serverUrl}
      token={token}
      connect={true}
      video={joinChoices.videoEnabled ? { deviceId: joinChoices.videoDeviceId } : false}
      audio={joinChoices.audioEnabled ? { deviceId: joinChoices.audioDeviceId } : false}
      onError={(roomError) => setError(roomError.message)}
      onDisconnected={() => setError("LiveKit disconnected from the meeting server")}
    >
      <VideoConference className="h-full" />
    </LiveKitRoom>
  )
}