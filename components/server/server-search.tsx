"use client";

import { Loader2, Search } from "lucide-react";
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
  data
}: ServerSearchProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [messageResults, setMessageResults] = useState<Array<{
    id: string;
    channelId: string;
    name: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const router = useRouter();

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
    if (!open || searchTerm.trim().length < 2) {
      setMessageResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
      fetch(`/api/search/messages?serverId=${encodeURIComponent(serverId)}&q=${encodeURIComponent(searchTerm.trim())}`, {
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
  }, [open, searchTerm, serverId]);

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
        className="group flex w-full items-center gap-x-2 border-b border-white/15 bg-transparent px-1 py-3 text-left transition hover:border-indigo-300/60"
      >
        <Search className="h-4 w-4 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-300 transition group-hover:text-white">
          Search
        </p>
        <kbd className="ml-auto inline-flex h-5 select-none items-center border border-white/10 px-1.5 font-mono text-[10px] font-medium text-zinc-400">
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
          }
        }}
      >
        <CommandInput
          placeholder="Search channels, members, and messages"
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="bg-surface text-white placeholder:text-zinc-400"
        />
        <CommandList>
          <CommandEmpty>
            No Results found
          </CommandEmpty>
          {data.map(({ label, type, data }) => {
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
                  onSelect={() => onClick({
                    id: message.id,
                    type: "message",
                    channelId: message.channelId,
                  })}
                >
                  <span className="truncate">{message.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
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