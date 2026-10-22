import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { CheckCircle2, MailCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmailVerifiedPage() {
  const user = await currentUser();
  const primaryEmail = user?.primaryEmailAddress;
  const emailIsVerified = primaryEmail?.verification?.status === "verified";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="surface-card w-full max-w-lg overflow-hidden">
        <div className="border-b border-border/70 bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10 px-7 py-8 text-center sm:px-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
            {emailIsVerified ? <CheckCircle2 className="h-7 w-7" /> : <MailCheck className="h-7 w-7" />}
          </div>
          <p className="section-kicker mt-5 text-primary">Bharat Meet account</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {emailIsVerified ? "Email verified. You’re all set." : "Your account is ready to continue."}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            {emailIsVerified
              ? `We’ve confirmed ${primaryEmail?.emailAddress}. Continue to create or open your workspace.`
              : "Continue to Bharat Meet. If your email still needs verification, we’ll guide you through it when you sign in."}
          </p>
        </div>
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-center sm:p-8">
          <Link
            href="/setup"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Continue to Bharat Meet
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground/80 transition hover:bg-surface-hover hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
