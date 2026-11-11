import { q, q1 } from "@/lib/db";
import { normalizeEmail } from "@/lib/access";
import { adminEmails } from "@/lib/server-config";

export type AppUser = { email: string; created: string };

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export const listUsers = () => q<AppUser>("SELECT email, created::text AS created FROM app.users ORDER BY email");

export const listedEmails = async () => new Set((await q<{ email: string }>("SELECT email FROM app.users")).map((r) => r.email));

export const isListedEmail = async (email: string) =>
  Boolean(await q1<{ ok: number }>("SELECT 1 AS ok FROM app.users WHERE email = $1", [normalizeEmail(email)]));

export async function addUser(email: string): Promise<{ error?: string }> {
  const who = normalizeEmail(email);
  if (!EMAIL_RE.test(who)) return { error: "Enter the person's full Microsoft email address." };
  if (adminEmails().includes(who)) return { error: "That person is already an administrator." };
  const added = await q1("INSERT INTO app.users(email) VALUES($1) ON CONFLICT DO NOTHING RETURNING email", [who]);
  return added ? {} : { error: "That person is already on the list." };
}

export const removeUser = async (email: string) => { await q("DELETE FROM app.users WHERE email = $1", [normalizeEmail(email)]); };
