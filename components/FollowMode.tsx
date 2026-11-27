"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FollowState } from "@/lib/following";

const POLL_MILLISECONDS = 3000;
const shortName = (email: string) => email.split("@")[0] || email;
const here = () => window.location.pathname + window.location.search;

const BAR: React.CSSProperties = { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, zIndex: 40, display: "grid", gap: 8, justifyItems: "center", maxWidth: "calc(100vw - 32px)" };
const ROW: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 10, color: "var(--ink)", fontSize: 13, boxShadow: "0 6px 20px rgba(0,0,0,.35)" };

export function FollowMode() {
  const router = useRouter();
  const [state, setState] = useState<FollowState | null>(null);
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");
  const busy = useRef(false);
  const applied = useRef("");

  const call = useCallback(async (action?: string, person?: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: here(), action, person }) });
      if (!response.ok) return;
      const next = (await response.json()) as FollowState & { error?: string };
      if (action) setMessage(next.error ?? "");
      setState(next);
      const target = next.following;
      if (!target) { applied.current = ""; return; }
      // Move only when the person being followed moves, so a page that redirects the follower away does not loop.
      if (target.online && target.path !== applied.current) {
        applied.current = target.path;
        if (target.path !== here()) router.push(target.path);
      }
    } catch {
      // A missed poll is fine; the next one catches up.
    } finally {
      busy.current = false;
    }
  }, [router]);

  useEffect(() => {
    const tick = () => { if (!document.hidden) void call(); };
    tick();
    const timer = setInterval(tick, POLL_MILLISECONDS);
    return () => clearInterval(timer);
  }, [call]);

  if (!state) return null;
  const { incoming, followers, requested, following, online } = state;
  const act = (action: string, person: string) => { void call(action, person); };

  return (
    <div style={BAR}>
      {incoming.map((person) => (
        <div key={person} style={ROW}>
          <span><b>{shortName(person)}</b> wants to follow you</span>
          <button type="button" className="btn primary" onClick={() => act("accept", person)}>Accept</button>
          <button type="button" className="btn" onClick={() => act("decline", person)}>Decline</button>
        </div>
      ))}
      {followers.map((person) => (
        <div key={person} style={ROW}>
          <span><b>{shortName(person)}</b> is following you</span>
          <button type="button" className="btn" onClick={() => act("stop", person)}>Remove</button>
        </div>
      ))}
      {following && (
        <div style={{ ...ROW, borderColor: "var(--brand)" }}>
          <span>Following <b>{shortName(following.leader)}</b>{following.online ? "" : " (offline, waiting)"}</span>
          <button type="button" className="btn" onClick={() => act("stop", following.leader)}>Stop</button>
        </div>
      )}
      {requested && (
        <div style={ROW}>
          <span>Waiting for <b>{shortName(requested)}</b> to accept</span>
          <button type="button" className="btn" onClick={() => act("stop", requested)}>Cancel</button>
        </div>
      )}
      {picking && !following && !requested && (
        <div style={ROW}>
          {online.length === 0 ? <span>No one else is online.</span> : (
            <>
              <select value={choice} onChange={(event) => setChoice(event.target.value)} aria-label="Person to follow" style={{ background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "6px 8px" }}>
                <option value="">Choose a person</option>
                {online.map((person) => <option key={person} value={person}>{shortName(person)}</option>)}
              </select>
              <button type="button" className="btn primary" disabled={!choice} onClick={() => { act("request", choice); setPicking(false); setChoice(""); }}>Request follow</button>
            </>
          )}
        </div>
      )}
      {message && <div style={{ ...ROW, borderColor: "var(--accent)" }} role="alert">{message}</div>}
      {!following && !requested && (
        <button type="button" className="btn" onClick={() => setPicking((open) => !open)} aria-expanded={picking}>{picking ? "Close" : "Follow someone"}</button>
      )}
    </div>
  );
}
