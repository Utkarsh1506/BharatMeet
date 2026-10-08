"use client";

import { Fragment, useEffect, useRef, ElementRef } from "react";
import { format } from "date-fns";
import { Member, Message, Profile } from "@prisma/client";
import { Loader2, ServerCrash, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useChatTyping } from "@/hooks/use-chat-typing";

import { ChatWelcome } from "./chat-welcome";
import { ChatItem } from "./chat-item";

const DATE_FORMAT = "d MMM yyyy, HH:mm";

type MessageWithMemberWithProfile = Message & {
  member: Member & {
    profile: Profile
  }
  reactions: Array<{
    emoji: string;
    memberId: string;
    messageId: string;
  }>
  replyTo?: any;
}

interface ChatMessagesProps {
  name: string;
  member: Member;
  chatId: string;
  apiUrl: string;
  socketUrl: string;
  socketQuery: Record<string, string>;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  type: "channel" | "conversation";
}

export const ChatMessages = ({
  name,
  member,
  chatId,
  apiUrl,
  socketUrl,
  socketQuery,
  paramKey,
  paramValue,
  type,
}: ChatMessagesProps) => {
  const queryKey = `chat:${chatId}`;
  const addKey = `chat:${chatId}:messages`;
  const updateKey = `chat:${chatId}:messages:update` 

  const chatRef = useRef<ElementRef<"div">>(null);
  const bottomRef = useRef<ElementRef<"div">>(null);
  const searchParams = useSearchParams();
  const targetMessageId = searchParams?.get("message") ?? null;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
  } = useChatQuery({
    queryKey,
    apiUrl,
    paramKey,
    paramValue,
  });
  useChatSocket({ queryKey, addKey, updateKey, type });
  const typingUsers = useChatTyping({ chatId });
  useChatScroll({
    chatRef,
    bottomRef,
    loadMore: fetchNextPage,
    shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
    count: data?.pages?.[0]?.items?.length ?? 0,
  })

  useEffect(() => {
    if (status !== "success" || !targetMessageId) {
      return;
    }

    const hasTargetMessage = data?.pages?.some((page) =>
      page.items?.some((message: MessageWithMemberWithProfile) => message.id === targetMessageId),
    );

    if (!hasTargetMessage && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
      return;
    }

    const target = document.getElementById(`message-${targetMessageId}`);

    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data, fetchNextPage, hasNextPage, isFetchingNextPage, status, targetMessageId]);

  if (status === "loading") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Loading messages...
        </p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center bg-surface/30 p-6 rounded-xl m-4 border border-border">
        <ServerCrash className="h-10 w-10 text-rose-500 my-4" />
        <p className="text-base font-semibold text-foreground">
          We couldn&apos;t load the messages
        </p>
        <p className="mt-1 mb-4 text-sm text-muted-foreground text-center max-w-sm">
          There might be a connection issue. Please check your network and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-active px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div ref={chatRef} className="flex-1 flex flex-col py-4 overflow-y-auto">
      {!hasNextPage && <div className="flex-1" />}
      {!hasNextPage && (
        <ChatWelcome
          type={type}
          name={name}
        />
      )}
      {hasNextPage && (
        <div className="flex justify-center">
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 text-zinc-500 animate-spin my-4" />
          ) : (
            <button
              onClick={() => fetchNextPage()}
              className="text-link hover:text-zinc-600 dark:text-link text-xs my-4 dark:hover:text-zinc-300 transition"
            >
              Load previous messages
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col-reverse mt-auto">
        {data?.pages?.map((group, i) => (
          <Fragment key={i}>
            {group.items.map((message: MessageWithMemberWithProfile) => (
              <ChatItem
                key={message.id}
                id={message.id}
                currentMember={member}
                member={message.member}
                content={message.content}
                fileUrl={message.fileUrl}
                deleted={message.deleted}
                timestamp={format(new Date(message.createdAt), DATE_FORMAT)}
                isUpdated={message.updatedAt !== message.createdAt}
                highlighted={message.id === targetMessageId}
                reactions={message.reactions || []}
                replyTo={message.replyTo}
                socketUrl={socketUrl}
                socketQuery={socketQuery}
              />
            ))}
          </Fragment>
        ))}
      </div>
        {typingUsers.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="px-4 pb-1 text-xs text-zinc-400"
          >
            <span className="mr-1 inline-flex gap-0.5 align-middle">
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-400" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-400 [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-400 [animation-delay:240ms]" />
            </span>
            {typingUsers.length === 1
              ? `${typingUsers[0].name} is typing...`
              : `${typingUsers.length} people are typing...`}
          </div>
        )}
      <div ref={bottomRef} />
    </div>
  )
}