"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

import { ModeToggle } from "@/components/mode-toggle";
import { NotificationsPanel } from "@/components/notifications-panel";
import { PresenceStatus } from "@/components/presence-status";
import { NavigationAction } from "./navigation-action";
import { ReminderCenter } from "@/components/reminder-center";
import { PwaInstallButton } from "@/components/pwa-install-button";

interface NavigationSidebarProps {
  servers: Array<{ id: string; name: string; imageUrl: string }>;
}

export const NavigationSidebar = ({ servers = [] }: NavigationSidebarProps) => {
  const pathname = usePathname();

  return (
    <header className="flex h-16 w-full items-center gap-1.5 border-b border-border/70 bg-sidebar/95 px-2.5 backdrop-blur-xl sm:gap-3 sm:px-5">
      <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-ring" aria-label="Bharat Meet home">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[10px] font-black tracking-[0.12em] text-primary-foreground shadow-md shadow-primary/15 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105">
          BM
        </span>
        <span className="hidden sm:!block">
          <span className="block text-sm font-bold leading-tight tracking-tight text-foreground">Bharat Meet</span>
          <span className="block text-[10px] leading-tight text-muted-foreground">A better room for every team</span>
        </span>
      </Link>

      <div className="mx-1 hidden h-8 w-px shrink-0 bg-border sm:!block" />

      <nav aria-label="Workspaces" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {servers.map((server) => {
          const isActive = pathname?.startsWith(`/servers/${server.id}`) ?? false;

          return (
            <Link
              key={server.id}
              href={`/servers/${server.id}`}
              aria-current={isActive ? "page" : undefined}
              className={`group flex h-10 max-w-36 shrink-0 items-center gap-1.5 rounded-xl border px-2 text-sm transition-all duration-200 sm:max-w-none sm:gap-2 sm:px-2.5 ${
                isActive
                  ? "border-primary/25 bg-primary/10 text-foreground shadow-sm shadow-primary/5"
                  : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface hover:text-foreground"
              }`}
            >
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/15 text-[9px] font-bold text-primary">
                {server.imageUrl ? (
                  <Image src={server.imageUrl} alt="" fill sizes="24px" className="object-cover" />
                ) : (
                  server.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <span className="max-w-14 truncate sm:max-w-36">{server.name}</span>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <NavigationAction />
        <PwaInstallButton />
        <ReminderCenter />
        <div className="hidden md:!block">
          <PresenceStatus />
        </div>
        <NotificationsPanel initialNotifications={[]} />
        <div className="hidden sm:!block"><ModeToggle /></div>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { avatarBox: "h-8 w-8 ring-1 ring-border shadow-none sm:h-9 sm:w-9" } }}
        />
      </div>
    </header>
  );
};
