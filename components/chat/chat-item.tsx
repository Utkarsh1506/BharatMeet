"use client";

import * as z from "zod";
import axios from "axios";
import qs from "query-string";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Member, MemberRole, Profile } from "@prisma/client";
import { Check, Edit, FileIcon, Link2, Reply, ShieldAlert, ShieldCheck, Trash } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

import { UserAvatar } from "@/components/user-avatar";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useReplyStore } from "@/hooks/use-reply-store";

interface ChatItemProps {
  id: string;
  content: string;
  member: Member & {
    profile: Profile;
  };
  timestamp: string;
  fileUrl: string | null;
  deleted: boolean;
  currentMember: Member;
  isUpdated: boolean;
  highlighted?: boolean;
  reactions: Array<{
    id?: string;
    emoji: string;
    memberId: string;
    messageId?: string;
    directMessageId?: string;
  }>;
  replyTo?: {
    id: string;
    content: string;
    fileUrl?: string | null;
    member?: {
      profile: {
        name: string;
      };
    };
  } | null;
  socketUrl: string;
  socketQuery: Record<string, string>;
};

const roleIconMap = {
  "GUEST": null,
  "MODERATOR": <ShieldCheck className="h-4 w-4 ml-2 text-indigo-500" />,
  "ADMIN": <ShieldAlert className="h-4 w-4 ml-2 text-rose-500" />,
}

const formSchema = z.object({
  content: z.string().min(1),
});

export const ChatItem = ({
  id,
  content,
  member,
  timestamp,
  fileUrl,
  deleted,
  currentMember,
  isUpdated,
  highlighted = false,
  reactions,
  replyTo,
  socketUrl,
  socketQuery
}: ChatItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { onOpen } = useModal();
  const onReply = useReplyStore((state) => state.onReply);
  const params = useParams();
  const router = useRouter();

  const onMemberClick = () => {
    if (member.id === currentMember.id) {
      return;
    }
  
    router.push(`/servers/${params?.serverId}/conversations/${member.id}`);
  }

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.key === "Escape" || event.keyCode === 27) {
        setIsEditing(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: content
    }
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: `${socketUrl}/${id}`,
        query: socketQuery,
      });

      await axios.patch(url, values);

      form.reset();
      setIsEditing(false);
    } catch (error) {
      form.setError("root", {
        message: axios.isAxiosError(error)
          ? error.response?.data || "Your message could not be updated."
          : "Your message could not be updated.",
      });
    }
  }

  useEffect(() => {
    form.reset({
      content: content,
    });
  }, [content, form]);

  const fileType = fileUrl?.split(".").pop();

  const isAdmin = currentMember.role === MemberRole.ADMIN;
  const isModerator = currentMember.role === MemberRole.MODERATOR;
  const isOwner = currentMember.id === member.id;
  const canDeleteMessage = !deleted && (isAdmin || isModerator || isOwner);
  const canEditMessage = !deleted && isOwner && !fileUrl;
  const isPDF = fileType === "pdf" && fileUrl;
  const isImage = !isPDF && fileUrl;
  const reactionOptions = ["👍", "🎉", "🔥", "❤️"];

  const handleReaction = async (emoji: string) => {
    try {
      const url = qs.stringifyUrl({
        url: `${socketUrl}/${id}`,
        query: socketQuery,
      });

      await axios.post(url, { emoji });
    } catch (error) {
      console.log("[MESSAGE_REACTION]", error);
    }
  };

  const copyMessageLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("message", id);

    try {
      await navigator.clipboard.writeText(url.toString());
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1600);
    } catch (error) {
      console.error("[MESSAGE_LINK_COPY]", error);
    }
  };

  return (
    <div
      id={`message-${id}`}
      className={cn(
        "group relative w-full border-l-2 border-transparent px-3 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.02] sm:px-4",
        highlighted && "border-indigo-400 bg-indigo-500/10"
      )}
    >
      <div className="flex w-full items-start gap-x-3">
        <button
          onClick={onMemberClick}
          className="mt-1 shrink-0 cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
          aria-label={`View ${member.profile.name}'s profile`}
        >
          <UserAvatar src={member.profile.imageUrl} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          {replyTo && (
            <div className="mb-1 flex items-center gap-x-1 pl-1 text-[11px] text-zinc-400">
              <Reply className="h-3 w-3" />
              <button
                className="hover:underline font-medium text-zinc-300 truncate"
                onClick={() => {
                  const el = document.getElementById(`message-${replyTo.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                @{replyTo?.member?.profile?.name ?? "Unknown"}
              </button>
              <span className="truncate max-w-[200px] md:max-w-md ml-1 opacity-75">
                {replyTo.fileUrl ? "Attachment" : replyTo.content}
              </span>
            </div>
          )}
          <div className="flex items-center gap-x-2">
            <div className="flex min-w-0 items-center">
              <button
                onClick={onMemberClick}
                className="cursor-pointer text-sm font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
              >
                {member.profile.name}
              </button>
              {roleIconMap[member.role] && (
                <ActionTooltip label={member.role}>
                  {roleIconMap[member.role]}
                </ActionTooltip>
              )}
            </div>
            <span className="text-[11px] text-zinc-400">
              {timestamp}
            </span>
          </div>

          <div className="mt-1 max-w-[min(100%,56rem)] border-t border-white/10 px-1 pt-2">
            {isImage && (
              <button
                onClick={() => onOpen("imageLightbox", { imageUrl: fileUrl })}
                className="relative mt-1 flex h-48 w-48 items-center overflow-hidden rounded-xl border border-white/5 bg-surface-hover sm:h-56 sm:w-56 cursor-zoom-in transition hover:opacity-90 active:scale-95"
              >
                <Image
                  src={fileUrl}
                  alt={content}
                  fill
                  sizes="(max-width: 640px) 14rem, 14rem"
                  className="object-cover"
                />
              </button>
            )}
            {isPDF && (
              <div className="mt-1 flex max-w-md items-center rounded-xl border border-white/5 bg-surface-hover p-3">
                <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sm text-indigo-300 hover:underline"
                >
                  PDF File
                </a>
              </div>
            )}
            {!fileUrl && !isEditing && (
              <p className={cn(
                "text-sm leading-6 text-zinc-200",
                deleted && "mt-1 text-xs italic text-zinc-400"
              )}>
                {content}
                {isUpdated && !deleted && (
                  <span className="mx-2 text-[10px] text-zinc-500">
                    (edited)
                  </span>
                )}
              </p>
            )}
            {!fileUrl && isEditing && (
              <Form {...form}>
                <form
                  className="mt-2 flex w-full items-center gap-x-2"
                  onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <div className="relative w-full">
                              <Input
                                disabled={isLoading}
                                className="border-white/5 bg-surface p-2.5 text-sm text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                                placeholder="Edited message"
                                {...field}
                              />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button disabled={isLoading} size="sm" variant="primary">
                      Save
                    </Button>
                </form>
                {form.formState.errors.root?.message && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}
                <span className="mt-1 text-[10px] text-zinc-400">
                  Press escape to cancel, enter to save
                </span>
              </Form>
            )}
          </div>

          {!deleted && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {reactionOptions.map((emoji) => {
                const matchCount = reactions.filter((reaction) => reaction.emoji === emoji).length;
                const hasReacted = reactions.some((reaction) => reaction.emoji === emoji && reaction.memberId === currentMember.id);

                if (!matchCount && !hasReacted) {
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReaction(emoji)}
                      className="inline-flex items-center gap-1 rounded-sm border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-indigo-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-hover"
                    >
                      <span>{emoji}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                      className={cn(
                      "inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-hover",
                      hasReacted
                        ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                        : "border-white/10 bg-surface text-zinc-300 hover:border-indigo-500/40"
                    )}
                  >
                    <span>{emoji}</span>
                    {matchCount > 0 && <span>{matchCount}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="absolute -top-1 right-5 hidden items-center gap-x-1 rounded-xl border border-white/5 bg-surface p-1 shadow-sm group-hover:flex">
        {!deleted && (
          <ActionTooltip label="Reply">
            <button
              type="button"
              aria-label="Reply to message"
              onClick={() => onReply({ id, content, fileUrl, memberName: member.profile.name })}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Reply className="h-4 w-4" />
            </button>
          </ActionTooltip>
        )}
        <ActionTooltip label={isCopied ? "Copied" : "Copy link"}>
          <button
            type="button"
            aria-label={isCopied ? "Message link copied" : "Copy message link"}
            onClick={copyMessageLink}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
          </button>
        </ActionTooltip>
        {canDeleteMessage && (
          <>
          {canEditMessage && (
            <ActionTooltip label="Edit">
              <button
                type="button"
                aria-label="Edit message"
                onClick={() => setIsEditing(true)}
                className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Edit className="h-4 w-4" />
              </button>
            </ActionTooltip>
          )}
          <ActionTooltip label="Delete">
            <button
              type="button"
              aria-label="Delete message"
              onClick={() => onOpen("deleteMessage", {
                apiUrl: `${socketUrl}/${id}`,
                query: socketQuery,
              })}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Trash className="h-4 w-4" />
            </button>
          </ActionTooltip>
          </>
        )}
        </div>
    </div>
  )
}