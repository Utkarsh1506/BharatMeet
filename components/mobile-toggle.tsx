import { Menu } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavigationSidebar } from "@/components/navigation/navigation-sidebar";
import { ServerSidebar } from "@/components/server/server-sidebar";

export const MobileToggle = ({
  serverId
}: {
  serverId: string;
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open workspace navigation"
          className="lg:hidden"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[92vw] max-w-[420px] gap-0 p-0">
        <div className="flex w-[72px] shrink-0">
          <NavigationSidebar />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <ServerSidebar serverId={serverId} />
        </div>
      </SheetContent>
    </Sheet>
  )
}