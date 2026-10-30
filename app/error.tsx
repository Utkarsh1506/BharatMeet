"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[APP_RENDER_ERROR]", { message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center bg-background p-6 text-foreground">
      <section role="alert" className="w-full max-w-xl rounded-2xl border border-destructive/35 bg-card p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-destructive">Screen error</p>
        <h1 className="mt-2 text-xl font-semibold">We couldn’t load this part of Bharat Meet.</h1>
        <p className="mt-3 break-words text-sm text-muted-foreground">{error.message || "No error message was provided."}</p>
        {error.digest && <p className="mt-3 rounded-lg bg-background p-3 font-mono text-xs">Error reference: {error.digest}</p>}
        <button type="button" onClick={reset} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Try again
        </button>
      </section>
    </main>
  );
}
