"use client";

import { ChannelType, MemberRole, Prisma } from "@prisma/client";
import { Hash, Mic, ShieldAlert, ShieldCheck, Video, Users2 } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { ServerHeader } from "./server-header";
import { ServerSearch } from "./server-search";
import { ServerSection } from "./server-section";
import { ServerChannel } from "./server-channel";
import { ServerMember } from "./server-member";

export type ServerWithRelations = Prisma.ServerGetPayload<{
  include: {
    channels: true;
    members: {
      include: {
        profile: {
          select: {
            id: true;
            userId: true;
            name: true;
            imageUrl: true;
            presenceStatus: true;
          };
        };
      };
    };
  };
}>;

interface ServerSidebarProps {
  server: ServerWithRelations;
  profileId: string;
  role: MemberRole;
}

const iconMap: Record<ChannelType, React.ReactNode> = {
  [ChannelType.TEXT]: <Hash className="mr-2 h-4 w-4" />,
  [ChannelType.AUDIO]: <Mic className="mr-2 h-4 w-4" />,
  [ChannelType.VIDEO]: <Video className="mr-2 h-4 w-4" />,
};

const roleIconMap: Record<MemberRole, React.ReactNode | null> = {
  [MemberRole.GUEST]: null,
  [MemberRole.MODERATOR]: <ShieldCheck className="h-4 w-4 mr-2 text-primary" />,
  [MemberRole.ADMIN]: <ShieldAlert className="h-4 w-4 mr-2 text-rose-400" />,
};

export const ServerSidebar = ({ server, profileId, role }: ServerSidebarProps) => {
  const textChannels = server.channels.filter((channel) => channel.type === ChannelType.TEXT);
  const audioChannels = server.channels.filter((channel) => channel.type === ChannelType.AUDIO);
  const videoChannels = server.channels.filter((channel) => channel.type === ChannelType.VIDEO);
  const members = server.members.filter((member) => member.profileId !== profileId);
  const serverForActions = server as any;

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/70 bg-panel text-foreground">
      <div className="border-b border-border/70 p-3">
        <ServerHeader server={serverForActions} role={role} />
        <div className="mt-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Users2 className="h-3.5 w-3.5" />
            </span>
            Your meeting space
          </div>
          <p className="mt-1.5 pl-8 text-[11px] leading-relaxed text-muted-foreground">
            {members.length + 1} {members.length === 0 ? "member" : "members"} · pick a room to join in
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 pb-4 pt-3">
        <div className="rounded-xl border border-border/70 bg-surface/80 p-1.5">
          <ServerSearch
            serverId={server.id}
            messageAuthors={server.members.map((member) => ({ id: member.id, name: member.profile.name }))}
            data={[
              { label: "Text rooms", type: "channel", data: textChannels.map((channel) => ({ id: channel.id, name: channel.name, icon: iconMap[channel.type] })) },
              { label: "Voice rooms", type: "channel", data: audioChannels.map((channel) => ({ id: channel.id, name: channel.name, icon: iconMap[channel.type] })) },
              { label: "Video rooms", type: "channel", data: videoChannels.map((channel) => ({ id: channel.id, name: channel.name, icon: iconMap[channel.type] })) },
              { label: "People", type: "member", data: members.map((member) => ({ id: member.id, name: member.profile.name, icon: roleIconMap[member.role] })) },
            ]}
          />
        </div>

        <Separator className="my-4 bg-border/70" />

        {textChannels.length > 0 && (
          <section className="mb-4">
            <ServerSection sectionType="channels" channelType={ChannelType.TEXT} role={role} label="Text rooms" />
            <div className="space-y-1">
              {textChannels.map((channel) => <ServerChannel key={channel.id} channel={channel} role={role} server={server} />)}
            </div>
          </section>
        )}

        {audioChannels.length > 0 && (
          <section className="mb-4">
            <ServerSection sectionType="channels" channelType={ChannelType.AUDIO} role={role} label="Voice rooms" />
            <div className="space-y-1">
              {audioChannels.map((channel) => <ServerChannel key={channel.id} channel={channel} role={role} server={server} />)}
            </div>
          </section>
        )}

        {videoChannels.length > 0 && (
          <section className="mb-4">
            <ServerSection sectionType="channels" channelType={ChannelType.VIDEO} role={role} label="Video rooms" />
            <div className="space-y-1">
              {videoChannels.map((channel) => <ServerChannel key={channel.id} channel={channel} role={role} server={server} />)}
            </div>
          </section>
        )}

        {members.length > 0 && (
          <section className="mb-2">
            <ServerSection sectionType="members" role={role} label="People" server={serverForActions} />
            <div className="space-y-1">
              {members.map((member) => <ServerMember key={member.id} member={member as any} server={server} />)}
            </div>
          </section>
        )}
      </ScrollArea>
      <div className="border-t border-border/70 px-3 py-2 text-center text-[10px] font-medium tracking-wide text-muted-foreground">
        BHARATMEET <span className="mx-1 text-primary">·</span> MEET, TOGETHER
      </div>
    </aside>
  );
};
