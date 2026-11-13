import { q, q1 } from "@/lib/db";
import { cleanModules } from "@/lib/modules";
import { normalizeEmail } from "@/lib/access";
import { adminEmails } from "@/lib/server-config";

export type AppUser = { email: string; created: string; modules: string[] | null };

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export const listUsers = () => q<AppUser>("SELECT email, created::text AS created, modules FROM app.users ORDER BY email");

/** A listed user's modules (null = all). A person with no row gets none, never everything. */
export async function userModules(email: string): Promise<string[] | null> {
  const row = await q1<{ modules: string[] | null }>("SELECT modules FROM app.users WHERE email = $1", [normalizeEmail(email)]);
  return row ? row.modules : [];
}

export async function setUserModules(email: string, values: unknown[]): Promise<{ error?: string }> {
  const modules = cleanModules(values);
  if (!modules.length) return { error: "Pick at least one module." };
  await q("UPDATE app.users SET modules = $2 WHERE email = $1", [normalizeEmail(email), modules]);
  return {};
}

export const listedEmails = async () => new Set((await q<{ email: string }>("SELECT email FROM app.users")).map((r) => r.email));

export const isListedEmail = async (email: string) =>
  Boolean(await q1<{ ok: number }>("SELECT 1 AS ok FROM app.users WHERE email = $1", [normalizeEmail(email)]));

export async function addUser(email: string, values: unknown[]): Promise<{ error?: string }> {
  const who = normalizeEmail(email);
  if (!EMAIL_RE.test(who)) return { error: "Enter the person's full Microsoft email address." };
  const modules = cleanModules(values);
  if (!modules.length) return { error: "Pick at least one module." };
  if (adminEmails().includes(who)) return { error: "That person is already an administrator." };
  const added = await q1("INSERT INTO app.users(email, modules) VALUES($1, $2) ON CONFLICT DO NOTHING RETURNING email", [who, modules]);
  return added ? {} : { error: "That person is already on the list." };
}

export const removeUser = async (email: string) => { await q("DELETE FROM app.users WHERE email = $1", [normalizeEmail(email)]); };
