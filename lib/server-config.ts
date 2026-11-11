import { devLoginEnabled, parseAdminEmails, passwordMatches } from "./access.ts";

if (typeof window !== "undefined") {
  throw new Error("lib/server-config.ts is server-only and must never run in the browser.");
}

type ServerEnv = Record<string, string | undefined>;

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