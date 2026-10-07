import Image from "next/image";
import { ArrowDown, CircleEllipsis } from "lucide-react";

import swagatamImage from "./swagatam.png";

interface ChatWelcomeProps {
  name: string;
  type: "channel" | "conversation";
};

export const ChatWelcome = ({
  name,
  type
}: ChatWelcomeProps) => {
  return (
    <div className="mb-6 rounded-2xl border border-border bg-card/60 px-4 py-5 md:px-8 md:py-7">
      {type === "channel" && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <Image
            src={swagatamImage}
            alt="Welcome illustration"
            className="h-9 w-9 object-contain"
            priority
          />
        </div>
      )}
      <p className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
        {type === "channel" ? `Welcome to ${name}` : `Start a conversation with ${name}`}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {type === "channel"
          ? "This is the beginning of this meeting room. Share an update, ask a question, or bring the team in."
          : `Send a message to ${name} to start the conversation.`
        }
      </p>
      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ArrowDown className="h-3.5 w-3.5" />
        <span>Your messages will appear here</span>
      </div>
    </div>
  )
}