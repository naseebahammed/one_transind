// Pure sign-in rules (no database, no framework) so `node --test` can load them.
export type Role = "admin" | "user";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Reads the ADMIN_EMAILS setting: comma separated, any case or spacing. */
export const parseAdminEmails = (value: string | undefined) =>
  (value ?? "").split(",").map(normalizeEmail).filter(Boolean);

/** Admins come only from the setting; everyone else needs a row in app.users. */
export function roleOf(email: string, adminEmails: readonly string[], listedEmails: ReadonlySet<string>): Role | null {
  const who = normalizeEmail(email);
  if (adminEmails.includes(who)) return "admin";
  return listedEmails.has(who) ? "user" : null;
}

/** True only when the token came from the tenant named in the issuer URL (https://login.microsoftonline.com/<tenant>/v2.0). */
export const inTenant = (tokenTenantId: string | undefined, issuer: string | undefined) =>
  !!tokenTenantId && !!issuer && issuer.split("/").includes(tokenTenantId);
