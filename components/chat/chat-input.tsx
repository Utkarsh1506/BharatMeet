"use client";

import * as z from "zod";
import axios from "axios";
import qs from "query-string";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mic, Plus, SendHorizontal, Square, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useModal } from "@/hooks/use-modal-store";
import { useReplyStore } from "@/hooks/use-reply-store";
import { EmojiPicker } from "@/components/emoji-picker";
import { useSocket } from "@/components/providers/socket-provider";
import { useUploadThing } from "@/lib/uploadthing";

interface ChatInputProps {
  apiUrl: string;
  query: Record<string, any>;
  name: string;
  type: "conversation" | "channel";
  enableVoiceNotes?: boolean;
}

const formSchema = z.object({
  content: z.string().trim().min(1, "Write a message before sending."),
});

const getRequestErrorMessage = (error: unknown) => {
  const fallback = "Your message could not be sent. Try again.";
  if (!axios.isAxiosError(error)) return fallback;

  const responseData = error.response?.data;
  if (typeof responseData === "string") return responseData;
  if (responseData && typeof responseData === "object") {
    const payload = responseData as { error?: string | { message?: string }; message?: string };
    if (typeof payload.error === "string") return payload.error;
    if (payload.error && typeof payload.error === "object" && payload.error.message) {
      return payload.error.message;
    }
    if (payload.message) return payload.message;
  }

  return fallback;
};

export const ChatInput = ({
  apiUrl,
  query,
  name,
  type,
  enableVoiceNotes = false,
}: ChatInputProps) => {
  const { onOpen } = useModal();
  const { isReplying, replyData, onCancel } = useReplyStore();
  const { socket } = useSocket();
  const { userId } = useAuth();
  const router = useRouter();
  const typingTimeout = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "ready" | "uploading">("idle");
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const uploadErrorRef = useRef("");
  const { startUpload, isUploading } = useUploadThing("messageFile", {
    onUploadError: (error) => {
      uploadErrorRef.current = error.message;
      setVoiceError(error.message);
      if (process.env.NODE_ENV === "development") console.error("[VOICE_NOTE_UPLOAD]", error);
    },
  });

  const chatId = query.channelId || query.conversationId;
  const draftKey = `bharatmeet:draft:${userId || "anonymous"}:${type}:${chatId}`;

  const stopTyping = () => {
    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }

    if (socket && chatId) {
      socket.emit("typing", { chatId, isTyping: false });
    }
  };

  const startTyping = () => {
    if (!socket || !chatId) {
      return;
    }

    socket.emit("typing", { chatId, isTyping: true });
    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = window.setTimeout(stopTyping, 1200);
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        window.clearTimeout(typingTimeout.current);
      }

      if (socket && chatId) {
        socket.emit("typing", { chatId, isTyping: false });
      }
    };
  }, [chatId, socket]);

  useEffect(() => () => {
    if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    }
  });

  const isLoading = form.formState.isSubmitting;

  const startVoiceNote = async () => {
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) voiceChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (voiceChunksRef.current.length) setVoiceState((current) => current === "recording" ? "ready" : current);
      };
      recorder.start(500);
      setVoiceSeconds(0);
      setVoiceState("recording");
      voiceTimerRef.current = window.setInterval(() => setVoiceSeconds((seconds) => {
        if (seconds >= 59) {
          if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        }
        return Math.min(seconds + 1, 60);
      }), 1000);
    } catch {
      setVoiceError("Allow microphone access to record a voice note.");
    }
  };

  const stopVoiceNote = () => {
    if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
    recorderRef.current?.stop();
  };

  const discardVoiceNote = () => {
    if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    voiceChunksRef.current = [];
    setVoiceState("idle");
    setVoiceSeconds(0);
  };

  const sendVoiceNote = async () => {
    if (!voiceChunksRef.current.length || voiceState === "uploading") return;
    setVoiceState("uploading");
    setVoiceError("");
    try {
      const recordedMime = recorderRef.current?.mimeType || "audio/webm";
      const uploadMime = recordedMime.split(";")[0] || "audio/webm";
      const blob = new Blob(voiceChunksRef.current, { type: uploadMime });
      if (blob.size > 8 * 1024 * 1024) throw new Error("Voice notes must be under 8 MB. Record a shorter note.");
      // `.webm` is classified as video/webm by UploadThing's extension lookup;
      // `.weba` correctly marks the same audio-only WebM container as audio/webm.
      const extension = uploadMime === "audio/mp4" ? "m4a" : uploadMime === "audio/ogg" ? "ogg" : "weba";
      const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: uploadMime });
      uploadErrorRef.current = "";
      const uploaded = await startUpload([file]);
      const fileUrl = uploaded?.[0]?.url;
      if (!fileUrl) throw new Error(uploadErrorRef.current || "The upload service did not return a file URL. Check the UploadThing server configuration and try again.");
      const url = qs.stringifyUrl({ url: apiUrl, query });
      await axios.post(url, { content: "Voice update", fileUrl });
      voiceChunksRef.current = [];
      setVoiceSeconds(0);
      setVoiceState("idle");
      router.refresh();
    } catch (error) {
      setVoiceError(axios.isAxiosError(error) ? getRequestErrorMessage(error) : error instanceof Error ? error.message : "The voice note could not be sent.");
      setVoiceState("ready");
    }
  };

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(draftKey);

    if (savedDraft) {
      form.setValue("content", savedDraft);
    }

    const subscription = form.watch((values) => {
      const content = values.content?.trim();

      if (content) {
        window.localStorage.setItem(draftKey, values.content || "");
      } else {
        window.localStorage.removeItem(draftKey);
      }
    });

    return () => subscription.unsubscribe();
  }, [draftKey, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query,
      });

      await axios.post(url, { ...values, replyToId: isReplying ? replyData?.id : undefined });

      stopTyping();
      form.reset();
      window.localStorage.removeItem(draftKey);
      if (isReplying) {
        onCancel();
      }
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: getRequestErrorMessage(error),
      });
    }
  }

  return (
    <div className="flex w-full flex-col relative">
      {isReplying && replyData && (
        <div className="z-10 -mb-2 mx-4 flex items-center justify-between rounded-t-2xl border-x border-t border-primary/20 bg-primary/5 px-4 py-2.5 text-sm transition-all">
          <div className="flex min-w-0 items-center gap-x-2 text-muted-foreground">
            <span className="shrink-0 font-semibold text-primary">Replying to {replyData.memberName}</span>
            <span className="max-w-[150px] truncate border-l border-border pl-2 sm:max-w-xs">{replyData.fileUrl ? "Attachment" : replyData.content}</span>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="z-20 mx-auto w-full max-w-[1120px] px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.65)]" />
          <span>{type === "conversation" ? "Direct message · just between you two" : `Room message · #${name}`}</span>
        </div>
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative rounded-2xl border border-border/80 bg-card px-3 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition focus-within:border-primary/50 focus-within:shadow-[0_12px_36px_hsl(var(--primary)/0.08)] sm:px-4">
                  {enableVoiceNotes && voiceState !== "idle" && (
                    <div className="mb-2 flex min-h-10 items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2 text-muted-foreground" aria-live="polite">
                        {voiceState === "recording" ? <><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /><span className="font-semibold text-foreground">Recording voice note</span><span className="tabular-nums">{String(Math.floor(voiceSeconds / 60)).padStart(2, "0")}:{String(voiceSeconds % 60).padStart(2, "0")}</span></> : voiceState === "uploading" || isUploading ? <><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>Uploading voice note…</span></> : <><Mic className="h-4 w-4 text-primary" /><span>Voice note ready · {voiceSeconds}s</span></>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {voiceState === "recording" && <button type="button" onClick={stopVoiceNote} className="rounded-lg bg-primary px-2.5 py-1.5 font-semibold text-primary-foreground"><Square className="mr-1 inline h-3 w-3 fill-current" />Finish</button>}
                        {voiceState === "ready" && <button type="button" onClick={() => void sendVoiceNote()} disabled={isUploading} className="rounded-lg bg-primary px-2.5 py-1.5 font-semibold text-primary-foreground disabled:opacity-50">Send note</button>}
                        {voiceState !== "uploading" && <button type="button" onClick={discardVoiceNote} aria-label="Discard voice note" className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen("messageFile", { apiUrl, query })}
                    aria-label="Attach a file"
                    className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-surface-hover text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <Input
                    disabled={isLoading || voiceState === "recording" || voiceState === "uploading"}
                    className={`border-0 bg-transparent px-12 py-5 ${enableVoiceNotes ? "pr-36" : "pr-12"} text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0`}
                    placeholder={`Message ${type === "conversation" ? name : `#${name}`}`}
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      if (event.target.value.trim()) {
                        startTyping();
                      } else {
                        stopTyping();
                      }
                    }}
                  />
                  <div className={`absolute ${enableVoiceNotes ? "right-24" : "right-12"} top-1/2 -translate-y-1/2`}>
                    <EmojiPicker
                      onChange={(emoji: string) => field.onChange(`${field.value} ${emoji}`)}
                    />
                  </div>
                  {enableVoiceNotes && (
                    <button
                      type="button"
                      disabled={voiceState !== "idle" || isLoading}
                      onClick={() => void startVoiceNote()}
                      aria-label="Record a voice note"
                      title="Record a voice note"
                      className="absolute right-14 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-surface-hover text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !field.value.trim()}
                    aria-label="Send message"
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" />
                    )}
                  </button>
                  {form.formState.errors.root?.message && (
                    <p role="alert" className="px-1 pt-2 text-xs text-destructive">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                  {voiceError && <p role="alert" className="px-1 pt-2 text-xs text-destructive">{voiceError}</p>}
                  {isLoading && (
                    <Loader2 className="absolute right-14 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
                  )}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
    </div>
  )
}
