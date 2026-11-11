// Pure server-side validation and SQL-safety helpers (no database or framework imports) so `node --test` can run them directly.

/** Maximum signed 32-bit integer accepted by PostgreSQL SERIAL / INTEGER columns. */
export const MAX_PG_INT = 2_147_483_647;

/** Safe ceiling for NUMERIC(18,2) financial columns (max 9,999,999,999,999,999.99). */
export const MAX_FIGURE_AMOUNT = 1_000_000_000_000_000;

const CONTROL_CHARS_INLINE_RE = /[\u0000-\u001F\u007F-\u009F]+/g;
const CONTROL_CHARS_MULTILINE_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]+/g;
const SLUG_KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SQL_TABLE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/;

/**
 * Parses a positive 32-bit PostgreSQL row ID (1 .. 2,147,483,647).
 * Returns null for zero, negatives, decimals, NaN, booleans, arrays, non-numeric strings, or values that overflow PG INT4.
 */
export function parsePositiveIntId(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw >= 1 && raw <= MAX_PG_INT ? raw : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^\d{1,10}$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PG_INT ? parsed : null;
  }
  return null;
}

/**
 * Parses a non-negative integer bounded by `max` (defaults to PostgreSQL INT4 max).
 * Treats null, undefined, or empty string as 0 when `emptyIsZero` is true.
 */
export function parseNonNegativeInt(raw: unknown, max: number = MAX_PG_INT, emptyIsZero = false): number | null {
  if (raw === null || raw === undefined || raw === "") {
    return emptyIsZero ? 0 : null;
  }
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw >= 0 && raw <= max ? raw : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^\d{1,10}$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
  }
  return null;
}

/** Validates a finite currency/metric figure within PostgreSQL NUMERIC(18,2) bounds. */
export function isValidFigureAmount(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isFinite(raw) && Math.abs(raw) < MAX_FIGURE_AMOUNT;
}

/**
 * Sanitizes single-line text input: converts null/undefined/File safely to "", strips null bytes and control characters
 * (which crash PostgreSQL UTF-8 TEXT parameters), collapses internal whitespace, trims, and caps length.
 */
export function cleanText(raw: unknown, maxLength: number): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw)
    .replace(CONTROL_CHARS_INLINE_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitizes multiline user text (e.g. Ask AI questions): strips null bytes and non-whitespace control characters,
 * trims outer whitespace, and caps length.
 */
export function cleanMultilineText(raw: unknown, maxLength: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS_MULTILINE_RE, "")
    .trim()
    .slice(0, maxLength);
}

/** Validates a lowercase slug key (e.g. sector or company-type key), returning null on missing or malformed values. */
export function parseSlugKey(raw: unknown, maxLength = 40): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return SLUG_KEY_RE.test(trimmed) ? trimmed : null;
}

/**
 * Escapes `\`, `%`, and `_` in a search string for safe use with `ILIKE $1 ESCAPE '\'`.
 * Prevents wildcard injection and PostgreSQL error 22025 on trailing backslashes.
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Strictly validates a SQL table/view identifier from server configuration (`schema.table` or `table`).
 * Rejects missing values, quotes, spaces, comments, semicolons, or expressions so SQL injection via config is impossible.
 */
export function validateSqlTableIdentifier(raw: string | undefined): string {
  const candidate = raw?.trim() ?? "";
  if (!candidate || candidate.length > 120 || !SQL_TABLE_IDENTIFIER_RE.test(candidate)) {
    throw new Error("SALES_TABLE must be a valid table or schema.table identifier.");
  }
  return candidate;
}
