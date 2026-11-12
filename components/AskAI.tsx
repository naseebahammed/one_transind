"use client";
import { useRef, useState } from "react";

type Msg = { role: "user" | "ai"; text: string };

const SUGGESTIONS = ["Top selling brand this month", "Which customer group grew fastest?", "Show returns rate by sector"];

export function AskAI() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const body = useRef<HTMLDivElement>(null);
  const scroll = () => requestAnimationFrame(() => body.current?.scrollTo({ top: 1e9, behavior: "smooth" }));

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ(""); setBusy(true); scroll();
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "ai", text: j.answer ?? j.error ?? "No answer" }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: "Request failed — try again." }]);
    }
    setBusy(false); scroll();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); }
  }

  // Free-floating: drag the button or the panel header; offset is relative to the default corner.
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragged = useRef(false);

  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest(".ai-widget-close")) return;
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
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div ref={box} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 20, display: "grid", gap: 10, justifyItems: "end", transform: `translate(${pos.x}px, ${pos.y}px)` }}>
      {open && (
        <div className="panel ask-ai-panel ai-widget">
          <header className="ai-widget-head" onPointerDown={startDrag} style={{ cursor: "move", touchAction: "none" }}>
            <span className="ai-widget-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" /></svg>
              Ask AI
            </span>
            <button type="button" className="ai-widget-close" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div className="ai-widget-body" ref={body}>
            {!msgs.length && !busy && (
              <div className="ai-widget-empty">
                <p>Ask anything about sales, brands or customers.</p>
                <div className="ai-widget-suggestions">
                  {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => <div key={i} className={`ai-bubble ${m.role}`}>{m.text}</div>)}
            {busy && <div className="ai-bubble ai ai-thinking" aria-live="polite" aria-label="Thinking"><span /><span /><span /></div>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="ai-widget-input">
            <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} maxLength={1000} rows={1} placeholder="Message Ask AI…" autoFocus />
            <button type="submit" disabled={busy || !q.trim()} aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      )}
      <button className="btn primary ask-ai-btn" onPointerDown={startDrag} onClick={() => { if (!dragged.current) setOpen(!open); }} aria-expanded={open} style={{ cursor: "move", touchAction: "none" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
          <path d="M19 14l.9 2.7L22.5 17.5l-2.6.8L19 21l-.9-2.7L15.5 17.5l2.6-.8L19 14z" opacity=".75" />
        </svg>
        {open ? "Close" : "Ask AI"}
      </button>
    </div>
  );
}
