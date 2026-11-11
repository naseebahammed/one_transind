// Pure sign-in rules (no database, no framework) so `node --test` can load them.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

const MULTI_TENANT_ISSUERS = new Set(["common", "organizations", "consumers", "v2.0"]);

/** True only when the token came from the single tenant named in the issuer URL (https://login.microsoftonline.com/<tenant>/v2.0). */
export function inTenant(tokenTenantId: string | undefined, issuer: string | undefined) {
  if (!tokenTenantId || !issuer || MULTI_TENANT_ISSUERS.has(tokenTenantId.toLowerCase())) return false;
  try {
    const tenant = new URL(issuer).pathname.split("/").filter(Boolean)[0];
    return !!tenant && !MULTI_TENANT_ISSUERS.has(tenant.toLowerCase()) && tenant === tokenTenantId;
  } catch {
    return false;
  }
}

/** HTTP status for an API route guard: 401 when unauthenticated, 403 when unapproved or missing admin role, null when allowed. */
export function apiStatus(email: string | null | undefined, role: Role | null, need: Role = "user"): 401 | 403 | null {
  if (!email) return 401;
  if (!role || (need === "admin" && role !== "admin")) return 403;
  return null;
}

/** The typed-email test login exists only when explicitly switched on AND the build is not production. */
export const devLoginEnabled = (env: { NODE_ENV?: string; AUTH_DEV_LOGIN?: string }) =>
  env.AUTH_DEV_LOGIN === "true" && env.NODE_ENV !== "production";

/** Hash for the temporary admin password login: "salt:hash" in hex (scrypt, built into Node). */
export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

/** True when `password` matches the stored "salt:hash". A missing or malformed stored value never matches. */
export function passwordMatches(password: string, stored: string | undefined) {
  if (!password || password.length > 256) return false;
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash || !/^[0-9a-f]{64}$/i.test(hash)) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 32);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
