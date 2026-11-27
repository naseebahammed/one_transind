import { q, q1 } from "@/lib/db";
import { normalizeEmail } from "@/lib/access";

/** A browser reports its page every 3 s; someone silent for this long counts as offline. */
export const ONLINE_SECONDS = 15;

/** Where each leader's mouse is, as fractions of their window. Kept in memory, not the database: it changes 4 times a second and is worthless after a few seconds.
 * shortcut: lives in one Node process, so it breaks if the app runs as several processes (pm2 cluster mode); move it to the database then. */
const cursors = ((globalThis as unknown as { _followCursors?: Map<string, { x: number; y: number; at: number }> })._followCursors ??= new Map());
const CURSOR_FRESH_MILLISECONDS = 3000;

export function reportCursor(me: string, value: unknown) {
  const point = value as { x?: unknown; y?: unknown } | null;
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
  if (!(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) return;
  cursors.set(me, { x: point.x, y: point.y, at: Date.now() });
}

function cursorOf(leader: string) {
  const found = cursors.get(leader);
  return found && Date.now() - found.at < CURSOR_FRESH_MILLISECONDS ? { x: found.x, y: found.y } : null;
}

export type FollowState = {
  /** People asking to follow me, waiting for my answer. */
  incoming: string[];
  /** People following me. */
  followers: string[];
  /** The person I asked to follow, still waiting for their answer. */
  requested: string | null;
  /** The person I am following and where they are now. */
  following: { leader: string; path: string; online: boolean; cursor: { x: number; y: number } | null } | null;
  /** Other people who can be asked to be followed. */
  online: string[];
};

/** A page address inside this app: starts with one "/", fits in a column, and is not an API or sign-in address. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/^\/(api|signin|no-access)(\/|\?|$)/.test(value)) return null;
  return value;
}

export async function followState(me: string): Promise<FollowState> {
  const [rows, online, leader] = await Promise.all([
    q<{ follower: string; leader: string; status: string }>("SELECT follower, leader, status FROM app.follow_requests WHERE follower = $1 OR leader = $1", [me]),
    q<{ email: string }>(`SELECT email FROM app.user_presence WHERE email <> $1 AND seen > now() - interval '${ONLINE_SECONDS} seconds' ORDER BY email`, [me]),
    q1<{ leader: string; path: string | null; online: boolean | null }>(
      `SELECT r.leader, p.path, (p.seen > now() - interval '${ONLINE_SECONDS} seconds') AS online
       FROM app.follow_requests r LEFT JOIN app.user_presence p ON p.email = r.leader
       WHERE r.follower = $1 AND r.status = 'accepted'`, [me]),
  ]);
  const pending = rows.find((r) => r.follower === me && r.status === "pending");
  return {
    incoming: rows.filter((r) => r.leader === me && r.status === "pending").map((r) => r.follower),
    followers: rows.filter((r) => r.leader === me && r.status === "accepted").map((r) => r.follower),
    requested: pending ? pending.leader : null,
    following: leader && leader.path ? { leader: leader.leader, path: leader.path, online: Boolean(leader.online), cursor: cursorOf(leader.leader) } : null,
    online: online.map((r) => r.email),
  };
}

/** Records where this person is now. Called with every poll, so it doubles as the "online" signal. */
export async function reportPresence(me: string, path: unknown) {
  const clean = cleanPath(path);
  if (!clean) return;
  await q("INSERT INTO app.user_presence(email, path, seen) VALUES($1, $2, now()) ON CONFLICT (email) DO UPDATE SET path = $2, seen = now()", [me, clean]);
}

/** Asks `to` for permission to follow them. One open request per person: a new one replaces the old. */
export async function requestFollow(me: string, to: string): Promise<{ error?: string }> {
  const leader = normalizeEmail(to);
  if (leader === me) return { error: "You cannot follow yourself." };
  const here = await q1("SELECT 1 AS ok FROM app.user_presence WHERE email = $1 AND seen > now() - interval '" + ONLINE_SECONDS + " seconds'", [leader]);
  if (!here) return { error: "That person is not online." };
  // Two people following each other would swap pages forever.
  const loop = await q1("SELECT 1 AS ok FROM app.follow_requests WHERE follower = $1 AND leader = $2 AND status = 'accepted'", [leader, me]);
  if (loop) return { error: "That person is already following you. Stop that first." };
  await q("INSERT INTO app.follow_requests(follower, leader, status) VALUES($1, $2, 'pending') ON CONFLICT (follower) DO UPDATE SET leader = $2, status = 'pending', created = now()", [me, leader]);
  return {};
}

export async function answerFollow(me: string, from: string, accept: boolean): Promise<{ error?: string }> {
  const follower = normalizeEmail(from);
  if (!accept) {
    await q("DELETE FROM app.follow_requests WHERE follower = $1 AND leader = $2", [follower, me]);
    return {};
  }
  const loop = await q1("SELECT 1 AS ok FROM app.follow_requests WHERE follower = $1 AND leader = $2 AND status = 'accepted'", [me, follower]);
  if (loop) return { error: "You are already following that person. Stop that first." };
  await q("UPDATE app.follow_requests SET status = 'accepted' WHERE follower = $1 AND leader = $2 AND status = 'pending'", [follower, me]);
  return {};
}

/** Ends a follow from either side: the follower stops following, or the leader removes a follower. */
export async function stopFollow(me: string, other: string) {
  const person = normalizeEmail(other);
  await q("DELETE FROM app.follow_requests WHERE (follower = $1 AND leader = $2) OR (follower = $2 AND leader = $1)", [me, person]);
}
