import { redirectToSignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { currentProfile } from "@/lib/current-profile";
import { ServerSidebar } from "@/components/server/server-sidebar";

const ServerIdLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { serverId: string };
}) => {
  const profile = await currentProfile();

  if (!profile) {
    return redirectToSignIn();
  }

  const server = await db.server.findUnique({
    where: {
      id: params.serverId,
      members: {
        some: {
          profileId: profile.id
        }
      }
    }
  });

  if (!server) {
    return redirect("/");
  }

  return (
    <div className="flex h-full min-w-0">
      {/* Server sidebar - hidden on mobile/tablet (< 1024px), visible on lg and up */}
      <div className="hidden lg:flex h-full w-[260px] shrink-0 flex-col overflow-hidden bg-panel">
        <ServerSidebar serverId={params.serverId} />
      </div>
      <main className="h-full min-w-0 flex-1">
        {children}
      </main>
    </div>
   );
}
 
export default ServerIdLayout;