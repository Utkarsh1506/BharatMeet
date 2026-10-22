import { NavigationSidebar } from "@/components/navigation/navigation-sidebar";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ServerNavigationProvider } from "@/components/providers/server-navigation-provider";

const MainLayout = async ({
  children
}: {
  children: React.ReactNode;
}) => {
  const profile = await currentProfile();
  const servers = profile
    ? await db.server.findMany({
        where: { members: { some: { profileId: profile.id } } },
        select: { id: true, name: true, imageUrl: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="h-full min-h-0 min-w-0">
      <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 h-16">
        <NavigationSidebar servers={servers} />
      </div>
      <div className="h-full min-h-0 min-w-0 pt-[calc(4rem+env(safe-area-inset-top))]">
        <ServerNavigationProvider servers={servers}>
          {children}
        </ServerNavigationProvider>
      </div>
    </div>
   );
}
 
export default MainLayout;
