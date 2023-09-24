import { CircleEllipsis } from "lucide-react";
import Image from "./swagatam.png"

interface ChatWelcomeProps {
  name: string;
  type: "channel" | "conversation";
};

export const ChatWelcome = ({
  name,
  type
}: ChatWelcomeProps) => {
  return (
    <div className="space-y-2 px-4 mb-4">
      {type === "channel" && (
        <div className="h-[75px] w-[75px] rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
          <img src="swagatam.png" alt="" />
          <CircleEllipsis className="h-12 w-12 text-[#476ee2]" />
        </div>
      )}
      {/* <p className="text-xl md:text-3xl font-bold">
        {type === "channel" ? "Welcome to 🫡 " : ""}{name}
      </p> */}
     
      <p className="text-zinc-600 dark:text-zinc-400 text-sm">
        {type === "channel"
          ? `This is the start of your conversation with ${name}`
          : `Let ${name} know you'd like to start a conversation`
        }
      </p>
    </div>
  )
}