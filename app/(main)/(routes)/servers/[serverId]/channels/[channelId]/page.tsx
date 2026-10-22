import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChannelType } from "@prisma/client";

import { currentProfile } from "@/lib/current-profile";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { MediaRoom } from "@/components/media-room";
import { RoomCompanion } from "@/components/chat/room-companion";
import { db } from "@/lib/db";

interface ChannelIdPageProps {
  params: Promise<{
    serverId: string;
    channelId: string;
  }>;
}

const ChannelIdPage = async ({ params: paramsPromise }: ChannelIdPageProps) => {
  const params = await paramsPromise;
  const profile = await currentProfile();

  if (!profile) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }

  const channel = await db.channel.findUnique({
    where: {
      id: params.channelId,
    },
  });

  const member = await db.member.findFirst({
    where: {
      serverId: params.serverId,
      profileId: profile.id,
    }
  });

  const server = await db.server.findFirst({
    where: {
      id: params.serverId,
      members: { some: { profileId: profile.id } },
    },
    include: {
      channels: { select: { id: true, type: true } },
      members: {
        include: {
          profile: {
            select: { id: true, name: true, imageUrl: true, presenceStatus: true },
          },
        },
        orderBy: { role: "asc" },
      },
    },
  });

  if (!channel || !member || !server || channel.serverId !== server.id) {
    redirect("/setup");
  }

  return ( 
    <div className="meeting-canvas flex h-full min-h-0 min-w-0 bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ChatHeader
        name={channel.name}
        serverId={channel.serverId}
        type="channel"
      />
      {channel.type === ChannelType.TEXT && (
        <>
          <ChatMessages
            member={member}
            name={channel.name}
            chatId={channel.id}
            type="channel"
            apiUrl="/api/messages"
            socketUrl="/api/socket/messages"
            socketQuery={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
            paramKey="channelId"
            paramValue={channel.id}
          />
          <ChatInput
            name={channel.name}
            type="channel"
            apiUrl="/api/socket/messages"
            enableVoiceNotes
            query={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
          />
        </>
      )}
      {channel.type === ChannelType.AUDIO && (
        <MediaRoom
          chatId={channel.id}
          serverId={server.id}
          channelName={channel.name}
          member={member}
          members={server.members}
          video={false}
          audio={true}
        />
      )}
      {channel.type === ChannelType.VIDEO && (
        <MediaRoom
          chatId={channel.id}
          serverId={server.id}
          channelName={channel.name}
          member={member}
          members={server.members}
          video={true}
          audio={true}
        />
      )}
      </div>
      {channel.type === ChannelType.TEXT && (
        <RoomCompanion
          roomName={channel.name}
          members={server.members}
          server={server}
          voiceChannelId={server.channels.find((room) => room.type === ChannelType.AUDIO)?.id}
        />
      )}
    </div>
   );
}
 
export default ChannelIdPage;
