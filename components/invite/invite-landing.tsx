"use client";

import axios from "axios";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export const InviteLanding = ({
  inviteCode,
  serverName,
}: {
  inviteCode: string;
  serverName: string;
}) => {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinWorkspace = async () => {
    setIsJoining(true);
    setError(null);

    try {
      const response = await axios.post(`/api/invites/${inviteCode}/join`);
      router.replace(`/servers/${response.data.serverId}`);
      router.refresh();
    } catch (cause) {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.error?.message ?? cause.response?.data?.message
        : null;
      setError(message || "We couldn’t accept this invite. Please try again.");
      setIsJoining(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 text-center sm:p-9">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <Users2 className="h-6 w-6" />
        </div>
        <p className="section-kicker justify-center">Workspace invitation</p>
        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-foreground">
          Join {serverName}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          You were invited to collaborate with this team. You’ll join only after you accept.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <Button onClick={joinWorkspace} disabled={isJoining} className="mt-6 w-full">
          {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          {isJoining ? "Joining workspace…" : "Accept invitation"}
        </Button>
      </section>
    </main>
  );
};
