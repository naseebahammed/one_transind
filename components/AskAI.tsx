"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { translator, type Language } from "@/lib/i18n";

type Msg = { role: "user" | "ai"; text: string };

function suggestionsForPath(pathname: string): string[] {
  if (pathname.startsWith("/finance")) {
    return [
      "Overdue receivables over 90 days",
      "Which company has the highest net profit?",
      "Show revenue vs cost by year",
    ];
  }
  if (pathname.startsWith("/hr")) {
    return [
      "Active employee headcount by company",
      "Recent joiners and leavers",
      "Total settlement payments this year",
    ];
  }
  if (pathname.startsWith("/real-estate")) {
    return [
      "Which building has the highest occupancy?",
      "Contracts ending in the next 60 days",
      "Compare revenue vs cost by property type",
    ];
  }
  if (pathname.startsWith("/logistics")) {
    return [
      "Late shipments and short deliveries",
      "Top drivers by delivery count",
      "FMCG warehouse stock summary",
    ];
  }
  return [
    "Top selling brand this month",
    "Which customer group grew fastest?",
    "Show returns rate by sector",
  ];
}

function readDocLanguage(): Language {
  if (typeof document !== "undefined" && document.documentElement.lang === "ar") return "ar";
  return "en";
}

export function AskAI() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("en");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLanguage(readDocLanguage());
    const observer = new MutationObserver(() => setLanguage(readDocLanguage()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const translate = translator(language);
  const suggestions = suggestionsForPath(pathname);
  const scroll = () => requestAnimationFrame(() => body.current?.scrollTo({ top: 1e9, behavior: "smooth" }));

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setBusy(true);
    scroll();
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "ai", text: j.answer ?? j.error ?? translate("No answer") }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: translate("Request failed — try again.") }]);
    }
    setBusy(false);
    scroll();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(q);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQ(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
  }

  async function copyAnswer(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {}
  }

  // Free-floating: drag the panel header or button; offset is relative to the default corner.
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragged = useRef(false);

  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest(".ai-widget-close, .ai-widget-icon-btn")) return;
    const el = box.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY, from = pos;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragged.current && Math.hypot(dx, dy) < 5) return;
      dragged.current = true;
      // keep the whole widget inside the window
      const x = Math.min(Math.max(dx, -rect.left), window.innerWidth - rect.right) + from.x;
      const y = Math.min(Math.max(dy, -rect.top), window.innerHeight - rect.bottom) + from.y;
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div ref={box} className="ask-ai-container" style={pos.x || pos.y ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}>
      {open && (
        <div className="panel ask-ai-panel ai-widget" role="dialog" aria-label={translate("Ask AI")}>
          <header className="ai-widget-head" onPointerDown={startDrag} style={{ cursor: "grab", touchAction: "none" }}>
            <span className="ai-widget-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" /></svg>
              {translate("Ask AI")}
            </span>
            <span className="ai-widget-actions">
              {msgs.length > 0 && (
                <button
                  type="button"
                  className="ai-widget-icon-btn"
                  onClick={() => { setMsgs([]); setCopiedIdx(null); }}
                  aria-label={translate("Clear chat")}
                  title={translate("Clear chat")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              )}
              <button type="button" className="ai-widget-close" onClick={() => setOpen(false)} aria-label={translate("Close")} title={translate("Close")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          </header>

          <div className="ai-widget-body" ref={body}>
            {!msgs.length && !busy && (
              <div className="ai-widget-empty">
                <p>{translate("Ask anything about sales, brands or customers.")}</p>
                <div className="ai-widget-suggestions">
                  {suggestions.map((s) => {
                    const label = translate(s);
                    return <button key={s} type="button" onClick={() => send(label)}>{label}</button>;
                  })}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ai-bubble-wrap ${m.role}`}>
                <div className={`ai-bubble ${m.role}`}>{m.text}</div>
                {m.role === "ai" && (
                  <button
                    type="button"
                    className="ai-copy-btn"
                    onClick={() => copyAnswer(m.text, i)}
                    aria-label={translate(copiedIdx === i ? "Copied" : "Copy")}
                  >
                    {translate(copiedIdx === i ? "Copied" : "Copy")}
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="ai-bubble ai ai-thinking" aria-live="polite" aria-label={translate("Thinking")}><span /><span /><span /></div>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="ai-widget-input">
            <textarea
              ref={inputRef}
              value={q}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              maxLength={1000}
              rows={1}
              placeholder={translate("Message Ask AI…")}
              autoFocus
            />
            <button type="submit" disabled={busy || !q.trim()} aria-label={translate("Send")} title={translate("Send")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className="btn primary ask-ai-btn"
        onPointerDown={startDrag}
        onClick={() => { if (!dragged.current) setOpen(!open); }}
        aria-expanded={open}
        style={{ cursor: "pointer", touchAction: "none" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
          <path d="M19 14l.9 2.7L22.5 17.5l-2.6.8L19 21l-.9-2.7L15.5 17.5l2.6-.8L19 14z" opacity=".75" />
        </svg>
        {open ? translate("Close") : translate("Ask AI")}
      </button>
    </div>
  );
}
