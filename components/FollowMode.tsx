"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FollowState } from "@/lib/following";

const SLOW_MILLISECONDS = 2000;
// While following or being followed, check 4 times a second so the mouse pointer moves smoothly.
const LIVE_MILLISECONDS = 250;
// While live, every 4th check (1 s) is a full one; the others only move the pointer.
const FULL_EVERY = 4;
const shortName = (email: string) => email.split("@")[0] || email;
const here = () => window.location.pathname + window.location.search;

const BAR: React.CSSProperties = { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, zIndex: 40, display: "grid", gap: 8, justifyItems: "center", maxWidth: "calc(100vw - 32px)" };
const ROW: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 10, color: "var(--ink)", fontSize: 13, boxShadow: "0 6px 20px rgba(0,0,0,.35)" };

export function FollowMode() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<FollowState | null>(null);
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");
  const busy = useRef(false);
  const again = useRef(false);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const live = useRef(false);
  const followingRef = useRef<FollowState["following"]>(null);
  const moved = useRef(false);
  const ticks = useRef(0);
  const applied = useRef("");

  const call = useCallback(async (action?: string, person?: string, light = false) => {
    if (busy.current) { again.current = true; return; } // run once more when the current call ends, so a page change is never dropped
    busy.current = true;
    try {
      const response = await fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: here(), action, person, light, cursor: live.current ? mouse.current : undefined }) });
      if (!response.ok) return;
      if (light) {
        const answer = (await response.json()) as { cursor: { x: number; y: number } | null };
        setState((now) => (now && now.following ? { ...now, following: { ...now.following, cursor: answer.cursor } } : now));
        return;
      }
      const next = (await response.json()) as FollowState & { error?: string };
      if (action) setMessage(next.error ?? "");
      setState(next);
      const target = next.following;
      if (!target) { applied.current = ""; return; }
      // Move only when the person being followed moves, so a page that redirects the follower away does not loop.
      if (target.online && !target.blocked && target.path !== applied.current) {
        applied.current = target.path;
        if (target.path !== here()) router.push(target.path);
      }
    } catch {
      // A missed poll is fine; the next one catches up.
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void call(); }
    }
  }, [router]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      ticks.current += 1;
      const full = !live.current || ticks.current % FULL_EVERY === 0;
      if (!document.hidden) {
        if (full) { moved.current = false; void call(); }
        // Between full checks: a leader only sends when the mouse moved, a follower only asks when someone is being followed.
        else if (followingRef.current || moved.current) { moved.current = false; void call(undefined, undefined, true); }
      }
      timer = setTimeout(tick, live.current ? LIVE_MILLISECONDS : SLOW_MILLISECONDS);
    };
    tick();
    const track = (event: MouseEvent) => { mouse.current = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight }; moved.current = true; };
    window.addEventListener("mousemove", track, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener("mousemove", track); };
  }, [call]);

  // Report a page change at once instead of waiting for the next poll, so followers see it sooner.
  useEffect(() => { void call(); }, [pathname, search, call]);

  if (!state) return null;
  const { incoming, followers, requested, following, online } = state;
  live.current = Boolean(following) || followers.length > 0;
  followingRef.current = following;
  const pointer = following && following.online ? following.cursor : null;
  const act = (action: string, person: string) => { void call(action, person); };

  return (
    <>
    {pointer && following && (
      <div aria-hidden="true" style={{ position: "fixed", left: pointer.x * 100 + "vw", top: pointer.y * 100 + "vh", zIndex: 60, pointerEvents: "none", transition: "left 250ms linear, top 250ms linear" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}><path d="M2 2 L2 16 L6 12 L9 18 L11.5 17 L8.5 11 L14 11 Z" fill="var(--accent)" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg>
        <span style={{ position: "absolute", left: 14, top: 16, background: "var(--accent)", color: "#fff", fontSize: 11, padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{shortName(following.leader)}</span>
      </div>
    )}
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
          <span>Following <b>{shortName(following.leader)}</b>{!following.online ? " (offline, waiting)" : following.blocked ? " (on a page you cannot open)" : ""}</span>
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
    </>
  );
}
