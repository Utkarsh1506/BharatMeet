"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ROOT_RENDER_ERROR]", { message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#101815", color: "#f4f0e7", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section role="alert" style={{ width: "min(100%, 620px)", border: "1px solid #75434a", borderRadius: 20, background: "#18211f", padding: 28 }}>
            <p style={{ color: "#ff9ca5", fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" }}>Application error</p>
            <h1 style={{ margin: "10px 0", fontSize: 24 }}>Bharat Meet could not start this screen.</h1>
            <p style={{ overflowWrap: "anywhere", color: "#c4ceca", lineHeight: 1.6 }}>{error.message || "No error message was provided."}</p>
            {error.digest && <pre style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap", borderRadius: 10, background: "#101815", padding: 14, fontSize: 12 }}>Error reference: {error.digest}</pre>}
            <button onClick={reset} style={{ marginTop: 12, border: 0, borderRadius: 10, background: "#e8b54f", color: "#17130c", cursor: "pointer", fontWeight: 700, padding: "11px 16px" }}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
