"use client";

import { CalendarDays, Hash, Loader2, Search, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";

interface ServerSearchProps {
  serverId: string;
  messageAuthors: { id: string; name: string }[];
  data: {
    label: string;
    type: "channel" | "member" | "message",
    data: {
      icon: React.ReactNode;
      name: string;
      id: string;
      channelId?: string;
    }[] | undefined
  }[]
}

export const ServerSearch = ({
  serverId,
  messageAuthors,
  data
}: ServerSearchProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelId, setChannelId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [messageResults, setMessageResults] = useState<Array<{
    id: string;
    channelId: string;
    channelName: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const router = useRouter();
  const textRooms = data.find((group) => group.label === "Text rooms")?.data ?? [];
  const people = messageAuthors;
  const hasFilters = Boolean(channelId || memberId || from || to);
  const isMessageSearch = searchTerm.trim().length >= 2 || hasFilters;

  const clearFilters = () => {
    setChannelId("");
    setMemberId("");
    setFrom("");
    setTo("");
  };

  useEffect(() => {
    setShortcutLabel(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    }

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down)
  }, []);

  useEffect(() => {
    if (!open || (searchTerm.trim().length < 2 && !hasFilters)) {
      setMessageResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ serverId, q: searchTerm.trim() });
      params.set("timezoneOffset", String(new Date().getTimezoneOffset()));
      if (channelId) params.set("channelId", channelId);
      if (memberId) params.set("memberId", memberId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      fetch(`/api/search/messages?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((response) => response.ok ? response.json() : { items: [] })
        .then((result) => {
          setMessageResults(result.items || []);
          setIsSearching(false);
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            setMessageResults([]);
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, searchTerm, serverId, channelId, memberId, from, to, hasFilters]);

  const onClick = ({ id, type, channelId }: { id: string, type: "channel" | "member" | "message", channelId?: string}) => {
    setOpen(false);

    if (type === "member") {
      return router.push(`/servers/${serverId}/conversations/${id}`)
    }

    if (type === "channel") {
      return router.push(`/servers/${serverId}/channels/${id}`)
    }

    if (type === "message" && channelId) {
      return router.push(`/servers/${serverId}/channels/${channelId}?message=${id}`)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Search channels and members (${shortcutLabel})`}
        className="group flex w-full items-center gap-x-2 rounded-lg bg-transparent px-2 py-2.5 text-left transition hover:bg-primary/5"
      >
        <Search className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
        <p className="text-sm font-medium text-muted-foreground transition group-hover:text-foreground">
          Search
        </p>
        <kbd className="ml-auto inline-flex h-5 select-none items-center rounded border border-border px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {shortcutLabel}
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchTerm("");
            setMessageResults([]);
            setIsSearching(false);
            clearFilters();
          }
        }}
      >
        <CommandInput
          placeholder="Search messages, rooms, and people"
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="bg-surface text-foreground placeholder:text-muted-foreground"
        />
        <div className="grid grid-cols-2 gap-2 border-b border-border/70 bg-card/80 px-3 py-3 sm:grid-cols-4 sm:px-4">
          <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2">
            <Hash className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="sr-only">Filter by text room</span>
            <select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none">
              <option value="">All rooms</option>
              {textRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </label>
          <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2">
            <User className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="sr-only">Filter by person</span>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none">
              <option value="">Anyone</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="sr-only">From date</span>
            <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-9 min-w-0 w-full bg-transparent text-[10px] text-foreground outline-none" />
          </label>
          <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="sr-only">To date</span>
            <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-9 min-w-0 w-full bg-transparent text-[10px] text-foreground outline-none" />
          </label>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="col-span-2 inline-flex h-8 items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:col-span-4">
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
        <CommandList>
          <CommandEmpty>
            No Results found
          </CommandEmpty>
          {!isMessageSearch && data.map(({ label, type, data }) => {
            if (!data?.length) return null;

            return (
              <CommandGroup key={label} heading={label}>
                  {data?.map(({ id, icon, name, channelId }) => {
                    return (
                      <CommandItem key={id} onSelect={() => onClick({ id, type, channelId })}>
                        {icon}
                        <span>{name}</span>
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            )
          })}
          {!!messageResults.length && (
            <CommandGroup heading="Message results">
              {messageResults.map((message) => (
                <CommandItem
                  key={message.id}
                  value={`${message.authorName} ${message.channelName} ${message.content}`}
                  onSelect={() => onClick({
                    id: message.id,
                    type: "message",
                    channelId: message.channelId,
                  })}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span className="truncate">{message.authorName}</span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">#{message.channelName}</span>
                      <span className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground">{new Date(message.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span className="line-clamp-2 text-xs font-normal text-muted-foreground">{message.content}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {open && searchTerm.trim().length < 2 && !hasFilters && (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">Type at least 2 characters or choose a filter to search messages.</div>
          )}
          {isSearching && (
            <CommandGroup heading="Message results">
              <CommandItem disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching messages...
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
