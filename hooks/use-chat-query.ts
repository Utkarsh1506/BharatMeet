import qs from "query-string";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useSocket } from "@/components/providers/socket-provider";

class ChatFetchError extends Error {
  constructor(message: string, readonly status?: number, readonly retryAfterMs?: number) {
    super(message);
    this.name = "ChatFetchError";
  }
}

interface ChatQueryProps {
  queryKey: string;
  apiUrl: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
};

export const useChatQuery = ({
  queryKey,
  apiUrl,
  paramKey,
  paramValue
}: ChatQueryProps) => {
  const { isConnected } = useSocket();

  const fetchMessages = async ({ pageParam = undefined, signal }: { pageParam?: string; signal?: AbortSignal }) => {
    const url = qs.stringifyUrl({
      url: apiUrl,
      query: {
        cursor: pageParam,
        [paramKey]: paramValue,
      }
    }, { skipNull: true });

    const res = await fetch(url, { signal });

    if (!res.ok) {
      let message = `Could not load messages (${res.status})`;
      try {
        const body = await res.json();
        message = body?.error?.message ?? body?.message ?? message;
      } catch {
        // Keep a useful status-based message when the response isn't JSON.
      }

      const retryAfter = Number(res.headers.get("Retry-After"));
      throw new ChatFetchError(
        message,
        res.status,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
      );
    }

    let data: { items?: unknown; nextCursor?: unknown };
    try {
      data = await res.json();
    } catch {
      throw new ChatFetchError("The message service returned an invalid response", res.status);
    }

    if (!data || !Array.isArray(data.items)) {
      throw new ChatFetchError("The message service returned an invalid response", res.status);
    }

    return {
      items: data.items,
      nextCursor: data?.nextCursor ?? null,
    };
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
  } = useInfiniteQuery({
    queryKey: [queryKey],
    queryFn: fetchMessages,
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (error instanceof ChatFetchError && error.status && error.status < 500 && error.status !== 429) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex, error) => {
      if (error instanceof ChatFetchError && error.retryAfterMs) return error.retryAfterMs;
      return Math.min(1_000 * 2 ** attemptIndex, 10_000);
    },
    refetchInterval: isConnected ? false : 5_000,
  });

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
  };
}
