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
    <div className="surface-card message-entry mx-auto mb-6 w-full max-w-[1080px] overflow-hidden bg-gradient-to-br from-card via-card/90 to-primary/[0.06] px-4 py-5 md:px-8 md:py-7">
      {type === "channel" && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm shadow-primary/10">
          <Image
            src={swagatamImage}
            alt="Welcome illustration"
            className="h-9 w-9 object-contain"
            priority
          />
        </div>
      )}
      <p className="text-xl font-bold tracking-[-0.03em] text-foreground md:text-2xl">
        {type === "channel" ? `Welcome to ${name}` : `Start a conversation with ${name}`}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {type === "channel"
          ? "A fresh space for the conversations ahead. Share an update, ask a question, or bring your people in."
          : `Send a message to ${name} to start the conversation.`
        }
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <ArrowDown className="h-3.5 w-3.5 text-primary" />
        <span>Start with a hello</span>
      </div>
    </div>
  )
}
