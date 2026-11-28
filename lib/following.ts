import { q, q1 } from "@/lib/db";
import { normalizeEmail } from "@/lib/access";
import {
  cleanPath,
  clearInvite,
  createInvite,
  cursorOf,
  hasInvite,
  invitesFor,
  invitesFrom,
  pageBlocked,
  presenceNeedsWrite,
  setWatching,
} from "@/lib/follow-rules";
import type { UserModules } from "@/lib/modules";

/** Idle browsers report every 12 s (active follow sessions every 1 s); someone silent for this long counts as offline. */
export const ONLINE_SECONDS = 35;

export type FollowState = {
  /** People asking to follow me, waiting for my answer. */
  incoming: string[];
  /** People following me. */
  followers: string[];
  /** The person I asked to follow, still waiting for their answer. */
  requested: string | null;
  /** Leaders who invited me to follow them, waiting for my answer. */
  invitedBy: string[];
  /** People I invited to follow me, waiting for their answer. */
  invited: string[];
  /** The person I am following and where they are now. `blocked` = they are on a page this person may not open. */
  following: { leader: string; path: string; online: boolean; blocked: boolean; cursor: { x: number; y: number } | null } | null;
  /** Other people who can be asked to be followed or invited. */
  online: string[];
};

/** Everything the follow bar needs in one database round trip. */
export async function followState(me: string, modules: UserModules): Promise<FollowState> {
  const row = await q1<{ relations: { follower: string; leader: string; status: string }[]; online: string[]; leader: { leader: string; path: string | null; online: boolean | null } | null }>(
    `SELECT
       (SELECT COALESCE(json_agg(json_build_object('follower', follower, 'leader', leader, 'status', status)), '[]') FROM app.follow_requests WHERE follower = $1 OR leader = $1) AS relations,
       (SELECT COALESCE(json_agg(email ORDER BY email), '[]') FROM app.user_presence WHERE email <> $1 AND seen > now() - interval '${ONLINE_SECONDS} seconds') AS online,
       (SELECT json_build_object('leader', r.leader, 'path', p.path, 'online', p.seen > now() - interval '${ONLINE_SECONDS} seconds')
          FROM app.follow_requests r LEFT JOIN app.user_presence p ON p.email = r.leader WHERE r.follower = $1 AND r.status = 'accepted') AS leader`, [me]);
  const relations = row?.relations ?? [];
  const leader = row?.leader ?? null;
  setWatching(me, leader ? leader.leader : null);
  const pending = relations.find((r) => r.follower === me && r.status === "pending");
  const followers = relations.filter((r) => r.leader === me && r.status === "accepted").map((r) => r.follower);
  const followerSet = new Set(followers);
  const blocked = leader && leader.path ? pageBlocked(leader.path, modules) : false;
  return {
    incoming: relations.filter((r) => r.leader === me && r.status === "pending").map((r) => r.follower),
    followers,
    requested: pending ? pending.leader : null,
    invitedBy: invitesFor(me).filter((from) => !leader || leader.leader !== from),
    invited: invitesFrom(me).filter((to) => !followerSet.has(to)),
    following: leader && leader.path
      ? {
          leader: leader.leader,
          path: blocked ? "" : leader.path,
          online: Boolean(leader.online),
          blocked,
          cursor: blocked ? null : cursorOf(leader.leader),
        }
      : null,
    online: row?.online ?? [],
  };
}

/** Records where this person is now, and that they are online. Writes at most every few seconds unless the page changed. */
export async function reportPresence(me: string, path: unknown) {
  const clean = cleanPath(path);
  if (!presenceNeedsWrite(me, clean ?? "")) return;
  // A page followers must not see (admin) still counts as online, but the last visible page stays.
  if (!clean) { await q("UPDATE app.user_presence SET seen = now() WHERE email = $1", [me]); return; }
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
  clearInvite(me, person);
  clearInvite(person, me);
  await q("DELETE FROM app.follow_requests WHERE (follower = $1 AND leader = $2) OR (follower = $2 AND leader = $1)", [me, person]);
}

/** Invites one or more online people to follow `me`. */
export async function inviteFollowers(me: string, people: string[]): Promise<{ error?: string }> {
  const targets = [...new Set(people.map(normalizeEmail).filter((p) => p && p !== me))];
  if (targets.length === 0) return { error: "Choose at least one person to invite." };
  const [onlineRows, loopRow] = await Promise.all([
    q<{ email: string }>(`SELECT email FROM app.user_presence WHERE email = ANY($1::text[]) AND seen > now() - interval '${ONLINE_SECONDS} seconds'`, [targets]),
    q1<{ leader: string }>("SELECT leader FROM app.follow_requests WHERE follower = $1 AND status = 'accepted'", [me]),
  ]);
  const onlineSet = new Set(onlineRows.map((r) => r.email));
  const myLeader = loopRow?.leader ?? null;
  let sent = 0;
  for (const target of targets) {
    if (!onlineSet.has(target)) continue;
    if (myLeader === target) continue;
    createInvite(me, target);
    sent += 1;
  }
  if (sent === 0) return { error: myLeader && targets.includes(myLeader) ? "You are already following that person. Stop that first." : "None of the selected people are online." };
  return {};
}

/** Accepts an invitation from `from` so `me` starts following them. */
export async function acceptInvite(me: string, from: string): Promise<{ error?: string }> {
  const leader = normalizeEmail(from);
  if (!hasInvite(leader, me)) return { error: "That invitation is no longer active." };
  const here = await q1(`SELECT 1 AS ok FROM app.user_presence WHERE email = $1 AND seen > now() - interval '${ONLINE_SECONDS} seconds'`, [leader]);
  if (!here) { clearInvite(leader, me); return { error: "That person is not online." }; }
  const loop = await q1("SELECT 1 AS ok FROM app.follow_requests WHERE follower = $1 AND leader = $2 AND status = 'accepted'", [leader, me]);
  if (loop) { clearInvite(leader, me); return { error: "That person is already following you. Stop that first." }; }
  await q("INSERT INTO app.follow_requests(follower, leader, status) VALUES($1, $2, 'accepted') ON CONFLICT (follower) DO UPDATE SET leader = $2, status = 'accepted', created = now()", [me, leader]);
  clearInvite(leader, me);
  return {};
}

export function declineInvite(me: string, from: string) {
  clearInvite(normalizeEmail(from), me);
}

export function cancelInvite(me: string, to: string) {
  clearInvite(me, normalizeEmail(to));
}
