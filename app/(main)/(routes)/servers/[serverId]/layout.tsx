import { redirectToSignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { MemberRole } from "@prisma/client";

import { db } from "@/lib/db";
import { currentProfile } from "@/lib/current-profile";
import { ServerNavigationProvider } from "@/components/providers/server-navigation-provider";
import { ServerWorkspaceFrame } from "@/components/server/server-workspace-frame";

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

  const server = await db.server.findFirst({
    where: {
      id: params.serverId,
      members: {
        some: {
          profileId: profile.id
        }
      }
    },
    include: {
      channels: { orderBy: { createdAt: "asc" } },
      members: {
        include: {
          profile: {
            select: { id: true, userId: true, name: true, imageUrl: true, presenceStatus: true },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!server) {
    return redirect("/");
  }

  const currentMember = server.members.find((member) => member.profileId === profile.id);

  if (!currentMember) {
    return redirect("/");
  }

  return (
    <ServerNavigationProvider server={server} profileId={profile.id} role={currentMember.role}>
      <ServerWorkspaceFrame server={server} profileId={profile.id} role={currentMember.role as MemberRole}>
        {children}
      </ServerWorkspaceFrame>
    </ServerNavigationProvider>
   );
}
 
export default ServerIdLayout;
