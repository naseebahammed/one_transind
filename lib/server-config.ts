import { randomBytes } from "node:crypto";
import { devLoginEnabled, parseAdminEmails, passwordMatches } from "./access.ts";
import { validateSqlTableIdentifier } from "./input-validation.ts";

if (typeof window !== "undefined") {
  throw new Error("lib/server-config.ts is server-only and must never run in the browser.");
}

type ServerEnv = Record<string, string | undefined>;

const globalSecret = globalThis as unknown as { _ephemeralSigningSecret?: string };

/** PostgreSQL connection settings read strictly on the server. */
export function databaseConfig(env: ServerEnv = process.env) {
  return {
    host: env.PGHOST,
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    ssl: env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

/** OpenAI API credentials and model selection, kept strictly on the server. */
export function openAiConfig(env: ServerEnv = process.env) {
  const apiKey = env.OPENAI_API_KEY?.trim() || undefined;
  return {
    apiKey,
    model: env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
}

/** Normalized administrator emails from ADMIN_EMAILS. */
export function adminEmails(env: ServerEnv = process.env): string[] {
  return parseAdminEmails(env.ADMIN_EMAILS);
}

/** True only when temporary administrator password sign-in is configured on the server. */
export function hasAdminPasswordLogin(env: ServerEnv = process.env): boolean {
  return Boolean(env.ADMIN_LOGIN_HASH?.trim());
}

/** Verifies an administrator password against ADMIN_LOGIN_HASH without exposing the hash to callers. */
export function verifyAdminPassword(password: string, env: ServerEnv = process.env): boolean {
  return passwordMatches(password, env.ADMIN_LOGIN_HASH);
}

/** Microsoft Entra single-tenant issuer URL from the server environment. */
export function entraIssuer(env: ServerEnv = process.env): string | undefined {
  return env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim() || undefined;
}

/** True only in non-production when AUTH_DEV_LOGIN=true is explicitly set. */
export function isDevLoginEnabled(env: ServerEnv = process.env): boolean {
  return devLoginEnabled(env);
}

/** Signing secret for server-issued anti-bot form tokens, using AUTH_SECRET or a per-process 256-bit fallback. */
export function authSigningSecret(env: ServerEnv = process.env): string {
  const configured = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();
  if (configured) return configured;
  return (globalSecret._ephemeralSigningSecret ??= randomBytes(32).toString("hex"));
}

/** Expected host:port from AUTH_URL when set, normalized to lowercase. */
export function configuredAuthHost(env: ServerEnv = process.env): string | undefined {
  const raw = env.AUTH_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return undefined;
  }
}

/** True only when running behind a trusted reverse proxy that sets X-Forwarded-For / X-Forwarded-Host. */
export function trustProxy(env: ServerEnv = process.env): boolean {
  return env.TRUST_PROXY === "true";
}

/** Validated PostgreSQL table or schema.table identifier for the read-only sales source (`SALES_TABLE`). */
export function salesTable(env: ServerEnv = process.env): string {
  return validateSqlTableIdentifier(env.SALES_TABLE);
}

function parseCutoffYear(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const year = Number(raw.trim());
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback;
}

/** Earliest calendar year loaded from daily receipt / Dukan sheets (`RECEIPTS_FROM_YEAR`, default 2026). */
export function receiptsFromYear(env: ServerEnv = process.env): number {
  return parseCutoffYear(env.RECEIPTS_FROM_YEAR, 2026);
}

/** Earliest calendar year loaded from restaurant COGS workbooks (`COGS_FROM_YEAR`, default 2024). */
export function cogsFromYear(env: ServerEnv = process.env): number {
  return parseCutoffYear(env.COGS_FROM_YEAR, 2024);
}
