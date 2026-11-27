"use client";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App page error:", error);
  }, [error]);

  return (
    <div style={{ maxWidth: 440, margin: "12vh auto 0", padding: 28, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", textAlign: "center" }}>
      <h2 style={{ color: "var(--ink)", fontSize: 20, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
        This page could not load — the database or report source may be busy. Try again in a moment.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button type="button" className="btn primary" onClick={reset}>Try again</button>
        <a href="/dashboard" className="btn">Go to dashboard</a>
      </div>
    </div>
  );
}
