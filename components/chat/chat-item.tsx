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

const getRequestErrorMessage = (error: unknown, fallback: string) => {
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

const roleIconMap = {
  "GUEST": null,
  "MODERATOR": <ShieldCheck className="h-4 w-4 ml-2 text-primary" />,
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
        message: getRequestErrorMessage(error, "Your message could not be updated."),
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
  const isVoiceUpdate = Boolean(fileUrl && content === "Voice update");
  const isPDF = fileType === "pdf" && fileUrl;
  const isImage = !isPDF && !isVoiceUpdate && fileUrl;
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
        "message-entry group relative w-full rounded-xl border-b border-border/35 px-3 py-3 transition-colors duration-200 hover:border-primary/20 hover:bg-card/35 sm:px-4 sm:py-3.5",
        highlighted && "border-primary/45 bg-primary/10 shadow-[0_8px_28px_hsl(var(--primary)/0.1)]"
      )}
    >
      <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3">
        <button
          onClick={onMemberClick}
          className="mt-0.5 shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View ${member.profile.name}'s profile`}
        >
          <UserAvatar src={member.profile.imageUrl} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          {replyTo && (
            <div className="mb-1 flex items-center gap-x-1 pl-1 text-[11px] text-muted-foreground">
              <Reply className="h-3 w-3" />
              <button
                className="hover:underline font-medium text-foreground/75 truncate"
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
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <div className="flex min-w-0 items-center">
              <button
                onClick={onMemberClick}
                className="min-w-0 max-w-full truncate cursor-pointer rounded-sm text-sm font-bold tracking-tight text-foreground hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {member.profile.name}
              </button>
              {roleIconMap[member.role] && (
                <ActionTooltip label={member.role}>
                  {roleIconMap[member.role]}
                </ActionTooltip>
              )}
            </div>
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70" title={timestamp}>
              {timestamp.split(", ").slice(-1)[0]}
            </span>
          </div>

          <div className="mt-1 max-w-[min(100%,56rem)] px-1 pt-1">
            {isImage && (
              <button
                onClick={() => onOpen("imageLightbox", { imageUrl: fileUrl })}
                className="relative mt-1 flex h-48 w-48 items-center overflow-hidden rounded-xl border border-border bg-surface-hover sm:h-56 sm:w-56 cursor-zoom-in transition hover:opacity-90 active:scale-95"
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
              <div className="mt-1 flex max-w-md items-center rounded-xl border border-border bg-surface-hover p-3">
                <FileIcon className="h-10 w-10 fill-primary/20 stroke-primary" />
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sm text-link hover:underline"
                >
                  PDF File
                </a>
              </div>
            )}
            {isVoiceUpdate && (
              <div className="mt-1 flex max-w-sm items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><FileIcon className="h-4 w-4" /></span>
                <audio className="h-9 min-w-0 flex-1" controls preload="metadata" src={fileUrl || undefined} aria-label={`Voice update from ${member.profile.name}`} />
              </div>
            )}
            {!fileUrl && !isEditing && (
              <p className={cn(
                "whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90",
                deleted && "mt-1 text-xs italic text-muted-foreground"
              )}>
                {content}
                {isUpdated && !deleted && (
                  <span className="mx-2 text-[10px] text-muted-foreground/70">
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
                                className="border-border bg-input p-2.5 text-sm text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
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
                <span className="mt-1 text-[10px] text-muted-foreground">
                  Press escape to cancel, enter to save
                </span>
              </Form>
            )}
          </div>

          {!deleted && (
            <div className="mt-2 flex max-h-10 flex-wrap items-center gap-1.5 opacity-100 transition-all duration-150 sm:max-h-0 sm:overflow-hidden sm:opacity-0 sm:group-hover:max-h-10 sm:group-hover:opacity-100 sm:group-focus-within:max-h-10 sm:group-focus-within:opacity-100">
              {reactionOptions.map((emoji) => {
                const matchCount = reactions.filter((reaction) => reaction.emoji === emoji).length;
                const hasReacted = reactions.some((reaction) => reaction.emoji === emoji && reaction.memberId === currentMember.id);

                if (!matchCount && !hasReacted) {
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReaction(emoji)}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/55 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      hasReacted
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-surface/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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

      <div className="message-actions relative ml-auto mt-2 flex w-fit max-w-full items-center gap-x-1 rounded-xl border border-border/80 bg-card p-1 shadow-sm opacity-100 transition-all duration-200 sm:z-10 sm:shadow-lg sm:pointer-events-none sm:-translate-y-1 sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-within:pointer-events-auto sm:focus-within:translate-y-0 sm:focus-within:opacity-100">
        {!deleted && (
          <ActionTooltip label="Reply">
            <button
              type="button"
              aria-label="Reply to message"
              onClick={() => onReply({ id, content, fileUrl, memberName: member.profile.name })}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
