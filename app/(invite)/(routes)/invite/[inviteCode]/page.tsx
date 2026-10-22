import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { currentProfile } from "@/lib/current-profile";
import { uuidSchema } from "@/lib/query-validation";
import { InviteLanding } from "@/components/invite/invite-landing";

interface InviteCodePageProps {
  params: Promise<{ inviteCode: string }>;
};

const InviteCodePage = async ({ params: paramsPromise }: InviteCodePageProps) => {
  const params = await paramsPromise;
  const parsedInviteCode = uuidSchema.safeParse(params.inviteCode);
  if (!parsedInviteCode.success) return notFound();

  const profile = await currentProfile();

  if (!profile) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn({ returnBackUrl: `/invite/${parsedInviteCode.data}` });
  }

  const server = await db.server.findUnique({
    where: { inviteCode: parsedInviteCode.data },
    select: { id: true, name: true },
  });

  if (!server) return notFound();

  const existingMembership = await db.member.findFirst({
    where: { serverId: server.id, profileId: profile.id },
    select: { id: true },
  });
  if (existingMembership) return redirect(`/servers/${server.id}`);

  return <InviteLanding inviteCode={parsedInviteCode.data} serverName={server.name} />;
}
 
export default InviteCodePage;
