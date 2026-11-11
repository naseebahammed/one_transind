import { roleOf, type Role } from "./access.ts";
import { adminEmails } from "./server-config.ts";

// Pure (no framework, no database import) so `node --test` can load it; the caller passes in the list reader.
/** Looks the person up fresh on every call. If the list cannot be read (database down, table not migrated yet), only env admins pass. */
export async function currentRole(email: string | null | undefined, loadListed: () => Promise<Set<string>>): Promise<Role | null> {
  if (!email) return null;
  const listed = await loadListed().catch(() => new Set<string>());
  return roleOf(email, adminEmails(), listed);
}
