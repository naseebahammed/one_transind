import { canOpen, type UserModules } from "./modules.ts";

// Pure follow-mode rules with no database, so they can be unit tested.

/** A page address inside this app: starts with one "/", fits in a column, and is not an API, sign-in, no-access or admin address. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/^\/(api|signin|no-access|admin)(\/|\?|#|$)/.test(value)) return null;
  return value;
}

/** The top-level page area of an address ("/sales?month=3" is "sales"); "" for the home page. */
export const pageArea = (path: string) => path.split(/[/?#]/)[1] ?? "";

/** True when a follower may not open the page their leader is on, so they stay where they are instead of landing on "no access". */
export const pageBlocked = (path: string, modules: UserModules) => {
  const area = pageArea(path);
  return area !== "" && !canOpen(modules, area);
};

// shortcut: the next four live in one Node process, so they break if the app runs as several processes (pm2 cluster mode); move them to the database then.
const store = globalThis as unknown as {
  _followCursors?: Map<string, { x: number; y: number; at: number }>;
  _followWatching?: Map<string, string | null>;
  _followWrites?: Map<string, { path: string; at: number }>;
  _followInvites?: Map<string, { leader: string; follower: string; at: number }>;
};
const cursors = (store._followCursors ??= new Map());
const watching = (store._followWatching ??= new Map());
const writes = (store._followWrites ??= new Map());
const invites = (store._followInvites ??= new Map());

export const CURSOR_FRESH_MILLISECONDS = 3000;
export const PRESENCE_REFRESH_MILLISECONDS = 5000;
export const INVITE_EXPIRE_MILLISECONDS = 5 * 60 * 1000;

const inviteKey = (leader: string, follower: string) => `${leader}\0${follower}`;

/** Records an invitation from `leader` asking `follower` to follow them. */
export function createInvite(leader: string, follower: string, now = Date.now()) {
  if (!leader || !follower || leader === follower) return;
  invites.set(inviteKey(leader, follower), { leader, follower, at: now });
}

export function clearInvite(leader: string, follower: string) {
  invites.delete(inviteKey(leader, follower));
}

export function hasInvite(leader: string, follower: string, now = Date.now()) {
  const key = inviteKey(leader, follower);
  const found = invites.get(key);
  if (!found) return false;
  if (now - found.at >= INVITE_EXPIRE_MILLISECONDS) {
    invites.delete(key);
    return false;
  }
  return true;
}

/** Followers that `leader` has invited and who have not answered yet. */
export function invitesFrom(leader: string, now = Date.now()): string[] {
  const list: string[] = [];
  for (const [key, entry] of invites) {
    if (now - entry.at >= INVITE_EXPIRE_MILLISECONDS) { invites.delete(key); continue; }
    if (entry.leader === leader) list.push(entry.follower);
  }
  return list.sort();
}

/** Leaders who invited `follower` to follow them. */
export function invitesFor(follower: string, now = Date.now()): string[] {
  const list: string[] = [];
  for (const [key, entry] of invites) {
    if (now - entry.at >= INVITE_EXPIRE_MILLISECONDS) { invites.delete(key); continue; }
    if (entry.follower === follower) list.push(entry.leader);
  }
  return list.sort();
}

/** Where each leader's mouse is, as fractions of their window. Kept in memory: it changes 4 times a second and is worthless after a few seconds. */
export function reportCursor(me: string, value: unknown, now = Date.now()) {
  const point = value as { x?: unknown; y?: unknown } | null;
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
  if (!(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) return;
  cursors.set(me, { x: point.x, y: point.y, at: now });
}

export function cursorOf(leader: string, now = Date.now()) {
  const found = cursors.get(leader);
  return found && now - found.at < CURSOR_FRESH_MILLISECONDS ? { x: found.x, y: found.y } : null;
}

/** Remembers whom `me` follows (null = nobody) so the cheap cursor-only call can answer without the database. */
export const setWatching = (me: string, leader: string | null) => { watching.set(me, leader); };
export const watchedCursor = (me: string) => {
  const leader = watching.get(me);
  return leader ? cursorOf(leader) : null;
};

/** False when this exact page was already saved moments ago, so a poll does not write to the database every time. */
export function presenceNeedsWrite(me: string, path: string, now = Date.now()) {
  const last = writes.get(me);
  if (last && last.path === path && now - last.at < PRESENCE_REFRESH_MILLISECONDS) return false;
  writes.set(me, { path, at: now });
  return true;
}
