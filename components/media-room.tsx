"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

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
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  useEffect(() => {
    if (!user) return;

    const name =
      user.fullName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      user.id;

    (async () => {
      try {
        const resp = await fetch(`/api/livekit?room=${chatId}&username=${name}`);
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
  }, [user, chatId]);

  if (!serverUrl) {
    return (
      <div className="flex flex-col flex-1 justify-center items-center px-4 text-center">
        <p className="text-sm font-medium text-red-500 dark:text-red-400">
          LiveKit is not configured.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Add NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 justify-center items-center px-4 text-center">
        <p className="text-sm font-medium text-red-500 dark:text-red-400">
          Meeting could not start.
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {error}
        </p>
      </div>
    )
  }

  if (token === "") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2
          className="h-7 w-7 text-zinc-500 animate-spin my-4"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Loading...
        </p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      data-lk-theme="default"
      serverUrl={serverUrl}
      token={token}
      connect={true}
      video={video}
      audio={audio}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}