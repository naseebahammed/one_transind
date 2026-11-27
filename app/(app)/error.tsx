"use client";
import { useEffect, useState } from "react";
import { translator, type Language } from "@/lib/i18n";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    console.error("App page error:", error);
    if (document.documentElement.lang === "ar") setLanguage("ar");
  }, [error]);

  const translate = translator(language);

  return (
    <div style={{ maxWidth: 440, margin: "12vh auto 0", padding: 28, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", textAlign: "center" }}>
      <h2 style={{ color: "var(--ink)", fontSize: 20, marginBottom: 8 }}>{translate("Something went wrong")}</h2>
      <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
        {translate("This page could not load — the database or report source may be busy. Try again in a moment.")}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button type="button" className="btn primary" onClick={reset}>{translate("Try again")}</button>
        <a href="/dashboard" className="btn">{translate("Go to dashboard")}</a>
      </div>
    </div>
  );
}
