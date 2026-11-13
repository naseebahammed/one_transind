import { q, q1 } from "@/lib/db";
import { isAccess, type Access } from "@/lib/access-levels";
import { normalizeEmail } from "@/lib/access";
import { adminEmails } from "@/lib/server-config";

export type AppUser = { email: string; created: string; access: Access };

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export const listUsers = () => q<AppUser>("SELECT email, created::text AS created, access FROM app.users ORDER BY email");

/** A listed user's access level; anything unexpected falls back to the narrowest level, never to full. */
export async function userAccess(email: string): Promise<Access> {
  const row = await q1<{ access: string }>("SELECT access FROM app.users WHERE email = $1", [normalizeEmail(email)]);
  return isAccess(row?.access) ? row.access : "finance";
}

export async function setUserAccess(email: string, access: unknown): Promise<{ error?: string }> {
  if (!isAccess(access)) return { error: "Unknown access level." };
  await q("UPDATE app.users SET access = $2 WHERE email = $1", [normalizeEmail(email), access]);
  return {};
}

export const listedEmails = async () => new Set((await q<{ email: string }>("SELECT email FROM app.users")).map((r) => r.email));

export const isListedEmail = async (email: string) =>
  Boolean(await q1<{ ok: number }>("SELECT 1 AS ok FROM app.users WHERE email = $1", [normalizeEmail(email)]));

export async function addUser(email: string, access: unknown): Promise<{ error?: string }> {
  const who = normalizeEmail(email);
  if (!EMAIL_RE.test(who)) return { error: "Enter the person's full Microsoft email address." };
  if (!isAccess(access)) return { error: "Choose an access level." };
  if (adminEmails().includes(who)) return { error: "That person is already an administrator." };
  const added = await q1("INSERT INTO app.users(email, access) VALUES($1, $2) ON CONFLICT DO NOTHING RETURNING email", [who, access]);
  return added ? {} : { error: "That person is already on the list." };
}

export const removeUser = async (email: string) => { await q("DELETE FROM app.users WHERE email = $1", [normalizeEmail(email)]); };
