import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { currentProfile } from "@/lib/current-profile"
import { db } from "@/lib/db";

import { NavigationAction } from "./navigation-action";
import { NavigationItem } from "./navigation-item";
import { NotificationsPanel } from "@/components/notifications-panel";
import { PresenceStatus } from "@/components/presence-status";

export const NavigationSidebar = async () => {
  const profile = await currentProfile();

  if (!profile) {
    return redirect("/");
  }

  const servers = await db.server.findMany({
    where: {
      members: {
        some: {
          profileId: profile.id
        }
      }
    }
  });

  const notifications = await db.notification.findMany({
    where: {
      profileId: profile.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
  });

  return (
    <div className="flex h-full w-full flex-col items-center border-r border-white/10 bg-sidebar px-2 py-3 text-primary">
      <Link
        href="/"
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-indigo-300/30 bg-indigo-500 text-[0.58rem] font-black tracking-[0.22em] text-white transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        aria-label="Home"
      >
        BM
      </Link>

      <NavigationAction />
      <Separator className="mx-auto my-1 h-px w-8 bg-white/15" />

      <ScrollArea className="flex-1 w-full pb-2">
        <div className="space-y-1 px-1">
          {servers.length === 0 ? (
            <div className="border-l border-dashed border-white/20 px-2 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              No spaces
            </div>
          ) : (
            servers.map((server) => (
              <div key={server.id}>
                <NavigationItem
                  id={server.id}
                  name={server.name}
                  imageUrl={server.imageUrl}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="mt-auto flex w-full flex-col items-center gap-y-3 border-t border-white/10 pb-2 pt-3">
        <div className="w-full px-1">
          <PresenceStatus />
        </div>
        <NotificationsPanel initialNotifications={notifications} />
        <ModeToggle />
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-[42px] w-[42px] ring-1 ring-white/10 shadow-none"
            }
          }}
        />
      </div>
    </div>
  )
}