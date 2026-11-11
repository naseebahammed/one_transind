import { normalizeEmail, type Role } from "./access.ts";
import { adminEmails } from "./server-config.ts";

export type ListedCheck = ((email: string) => Promise<boolean>) | (() => Promise<ReadonlySet<string>>);

// Pure (no framework, no database import) so `node --test` can load it; the caller passes in the user checker.
/** Looks the person up fresh on every call. Env admins skip the database lookup; if the database cannot be read, only env admins pass. */
export async function currentRole(email: string | null | undefined, checkListed: ListedCheck): Promise<Role | null> {
  if (!email) return null;
  const who = normalizeEmail(email);
  if (!who) return null;
  if (adminEmails().includes(who)) return "admin";
  const found = await checkListed(who).catch(() => false);
  const isListed = typeof found === "boolean" ? found : found.has(who);
  return isListed ? "user" : null;
}
