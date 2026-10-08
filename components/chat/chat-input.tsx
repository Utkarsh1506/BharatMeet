"use client";

import * as z from "zod";
import axios from "axios";
import qs from "query-string";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, SendHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
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

interface ChatInputProps {
  apiUrl: string;
  query: Record<string, any>;
  name: string;
  type: "conversation" | "channel";
}

const formSchema = z.object({
  content: z.string().trim().min(1, "Write a message before sending."),
});

export const ChatInput = ({
  apiUrl,
  query,
  name,
  type,
}: ChatInputProps) => {
  const { onOpen } = useModal();
  const { isReplying, replyData, onCancel } = useReplyStore();
  const { socket } = useSocket();
  const { userId } = useAuth();
  const router = useRouter();
  const typingTimeout = useRef<number | null>(null);

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    }
  });

  const isLoading = form.formState.isSubmitting;

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
        message: axios.isAxiosError(error)
          ? error.response?.data || "Your message could not be sent. Try again."
          : "Your message could not be sent. Try again.",
      });
    }
  }

  return (
    <div className="flex w-full flex-col relative">
      {isReplying && replyData && (
        <div className="mx-4 flex items-center justify-between rounded-t-xl bg-surface-hover/80 px-4 py-2.5 text-sm border-x border-t border-white/5 border-b-0 -mb-2 z-10 transition-all">
          <div className="flex items-center gap-x-2 text-zinc-400">
            <span className="font-semibold text-zinc-300">Replying to {replyData.memberName}</span>
            <span className="truncate max-w-[150px] sm:max-w-xs text-zinc-500 pl-1 border-l border-white/10">{replyData.fileUrl ? "Attachment" : replyData.content}</span>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-400 hover:text-white transition rounded-full p-1 hover:bg-white/10"
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-3 pb-4 sm:px-4 z-20">
        <div className="section-kicker mb-2 flex items-center gap-2 px-1">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <span>{type === "conversation" ? "Direct message" : `Message #${name}`}</span>
        </div>
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative border-y border-white/15 bg-surface/50 px-3 py-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => onOpen("messageFile", { apiUrl, query })}
                    aria-label="Attach a file"
                    className="absolute left-5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-white/10 bg-surface-hover text-zinc-200 transition hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <Input
                    disabled={isLoading}
                    className="border-0 bg-transparent px-12 py-5 text-white placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0"
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
                  <div className="absolute right-12 top-1/2 -translate-y-1/2">
                    <EmojiPicker
                      onChange={(emoji: string) => field.onChange(`${field.value} ${emoji}`)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !field.value.trim()}
                    aria-label="Send message"
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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