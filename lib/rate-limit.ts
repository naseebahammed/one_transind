import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { authSigningSecret, configuredAuthHost, trustProxy } from "./server-config.ts";

if (typeof window !== "undefined") {
  throw new Error("lib/rate-limit.ts is server-only and must never run in the browser.");
}

export type RateLimitRule = {
  key: string;
  maxRequests: number;
  windowMilliseconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetEpochSeconds: number;
};

export type ConcurrencyRule = {
  key: string;
  maxConcurrent: number;
};

type BucketEntry = {
  timestamps: number[];
  expiresAt: number;
};

type RateLimitStore = {
  buckets: Map<string, BucketEntry>;
  inFlight: Map<string, number>;
  usedNonces: Map<string, number>;
  lastSweepAt: number;
};

const MAX_BUCKETS = 10_000;
const MAX_NONCES = 5_000;
const SWEEP_INTERVAL_MS = 60_000;

const globalState = globalThis as unknown as { _rateLimitStore?: RateLimitStore };

function store(): RateLimitStore {
  return (globalState._rateLimitStore ??= {
    buckets: new Map(),
    inFlight: new Map(),
    usedNonces: new Map(),
    lastSweepAt: 0,
  });
}

/** Clears all in-memory rate-limit, concurrency, and nonce state (for isolated unit tests). */
export function resetRateLimitState() {
  const current = store();
  current.buckets.clear();
  current.inFlight.clear();
  current.usedNonces.clear();
  current.lastSweepAt = 0;
}

function sweepExpired(current: RateLimitStore, nowMilliseconds: number) {
  if (nowMilliseconds - current.lastSweepAt < SWEEP_INTERVAL_MS && current.buckets.size < MAX_BUCKETS) return;
  current.lastSweepAt = nowMilliseconds;
  for (const [key, entry] of current.buckets) {
    if (entry.expiresAt <= nowMilliseconds) current.buckets.delete(key);
  }
  for (const [nonce, expiresAt] of current.usedNonces) {
    if (expiresAt <= nowMilliseconds) current.usedNonces.delete(nonce);
  }
  while (current.buckets.size >= MAX_BUCKETS) {
    const victim = [...current.buckets.keys()].find((key) => !key.startsWith("global:"));
    if (!victim) break;
    current.buckets.delete(victim);
  }
}

/**
 * Evaluates multiple sliding-window rules atomically.
 * If any rule is exhausted, none of the other rules consume quota (preventing a rate-limited actor from starving global ceilings).
 */
export function checkMultiRateLimit(
  rules: readonly RateLimitRule[],
  nowMilliseconds: number = Date.now(),
): RateLimitDecision {
  const current = store();
  sweepExpired(current, nowMilliseconds);

  let deniedDecision: RateLimitDecision | null = null;
  const prepared: { rule: RateLimitRule; active: number[] }[] = [];

  for (const rule of rules) {
    const cutoff = nowMilliseconds - rule.windowMilliseconds;
    const existing = current.buckets.get(rule.key);
    const active = existing ? existing.timestamps.filter((t) => t > cutoff) : [];
    prepared.push({ rule, active });

    if (active.length >= rule.maxRequests) {
      const oldestInWindow = active[0] ?? nowMilliseconds;
      const resetMs = oldestInWindow + rule.windowMilliseconds;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - nowMilliseconds) / 1000));
      const candidate: RateLimitDecision = {
        allowed: false,
        limit: rule.maxRequests,
        remaining: 0,
        retryAfterSeconds,
        resetEpochSeconds: Math.ceil(resetMs / 1000),
      };
      if (!deniedDecision || candidate.retryAfterSeconds > deniedDecision.retryAfterSeconds) {
        deniedDecision = candidate;
      }
    }
  }

  if (deniedDecision) {
    for (const { rule, active } of prepared) {
      if (active.length > 0) {
        current.buckets.set(rule.key, { timestamps: active, expiresAt: active[active.length - 1] + rule.windowMilliseconds });
      } else {
        current.buckets.delete(rule.key);
      }
    }
    return deniedDecision;
  }

  let tightest: RateLimitDecision = {
    allowed: true,
    limit: Number.MAX_SAFE_INTEGER,
    remaining: Number.MAX_SAFE_INTEGER,
    retryAfterSeconds: 0,
    resetEpochSeconds: Math.ceil(nowMilliseconds / 1000),
  };

  for (const { rule, active } of prepared) {
    active.push(nowMilliseconds);
    const expiresAt = nowMilliseconds + rule.windowMilliseconds;
    current.buckets.delete(rule.key); // refresh insertion order for LRU
    current.buckets.set(rule.key, { timestamps: active, expiresAt });

    const remaining = Math.max(0, rule.maxRequests - active.length);
    const resetMs = (active[0] ?? nowMilliseconds) + rule.windowMilliseconds;
    if (remaining < tightest.remaining) {
      tightest = {
        allowed: true,
        limit: rule.maxRequests,
        remaining,
        retryAfterSeconds: 0,
        resetEpochSeconds: Math.ceil(resetMs / 1000),
      };
    }
  }

  return tightest;
}

/** Single-rule convenience wrapper around checkMultiRateLimit. */
export function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMilliseconds: number,
  nowMilliseconds: number = Date.now(),
): RateLimitDecision {
  return checkMultiRateLimit([{ key, maxRequests, windowMilliseconds }], nowMilliseconds);
}

/**
 * Atomically acquires in-flight concurrency slots across all given rules.
 * Returns an idempotent release function, or null if any rule is at capacity.
 */
export function acquireConcurrency(rules: readonly ConcurrencyRule[]): (() => void) | null {
  const current = store();
  for (const rule of rules) {
    if ((current.inFlight.get(rule.key) ?? 0) >= rule.maxConcurrent) {
      return null;
    }
  }
  for (const rule of rules) {
    current.inFlight.set(rule.key, (current.inFlight.get(rule.key) ?? 0) + 1);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const rule of rules) {
      const next = (current.inFlight.get(rule.key) ?? 1) - 1;
      if (next <= 0) current.inFlight.delete(rule.key);
      else current.inFlight.set(rule.key, next);
    }
  };
}

/** Standard HTTP rate-limit headers for 429 and guarded responses. */
export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const base: Record<string, string> = {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(decision.resetEpochSeconds),
    "Cache-Control": "no-store",
  };
  if (!decision.allowed) {
    base["Retry-After"] = String(decision.retryAfterSeconds);
  }
  return base;
}

export function rateLimitResponse(
  decision: RateLimitDecision,
  message = "Too many requests. Please wait a moment and try again.",
): Response {
  return Response.json({ error: message }, { status: 429, headers: rateLimitHeaders(decision) });
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function expandIpv6Prefix64(raw: string): string | null {
  const zoneStripped = raw.split("%")[0].toLowerCase();
  if (!/^[0-9a-f:]+$/.test(zoneStripped) || zoneStripped.includes(":::")) return null;
  const doubleColonParts = zoneStripped.split("::");
  if (doubleColonParts.length > 2) return null;

  const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
  const right = doubleColonParts.length === 2 && doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
  if (doubleColonParts.length === 1 && left.length !== 8) return null;
  if (left.length + right.length > 8) return null;

  const validHextets = [...left, ...right].every((h) => /^[0-9a-f]{1,4}$/.test(h));
  if (!validHextets) return null;

  const missing = 8 - (left.length + right.length);
  const full = [...left, ...Array.from({ length: missing }, () => "0"), ...right].map((h) => h.padStart(4, "0"));
  if (full.slice(0, 7).every((h) => h === "0000") && (full[7] === "0001" || full[7] === "0000")) {
    return "loopback";
  }
  return `ipv6:${full.slice(0, 4).join(":")}/64`;
}

/**
 * Normalizes a raw IP token (including IIS ip:port or bracketed [ipv6]:port) into a canonical rate-limit key.
 * IPv6 addresses are grouped by /64 subnet so rotating host suffixes inside one /64 cannot bypass limits.
 */
export function normalizeIpAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate) return null;

  // Bracketed IPv6 with optional port: [2001:db8::1]:54321
  if (candidate.startsWith("[")) {
    const closeIdx = candidate.indexOf("]");
    if (closeIdx === -1) return null;
    candidate = candidate.slice(1, closeIdx);
  } else if (candidate.includes(".") && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(candidate)) {
    // Windows IIS ARR / Azure proxy format: 203.0.113.10:54321
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  const mappedMatch = candidate.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedMatch) candidate = mappedMatch[1];

  if (isValidIpv4(candidate)) {
    return candidate.startsWith("127.") ? "loopback" : `ipv4:${candidate}`;
  }
  return expandIpv6Prefix64(candidate);
}

/**
 * Extracts client IP safely without allowing X-Forwarded-For spoofing:
 * - When trustProxyEnabled is false (default), forwarding headers are ignored completely.
 * - When trustProxyEnabled is true, reads the rightmost hop appended by the trusted reverse proxy (never index 0).
 */
export function extractClientIp(
  headers: Pick<Headers, "get">,
  trustProxyEnabled: boolean = trustProxy(),
): string {
  if (!trustProxyEnabled) return "direct";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    for (let idx = hops.length - 1; idx >= 0; idx--) {
      const parsed = normalizeIpAddress(hops[idx]);
      if (parsed) return parsed;
    }
  }
  return normalizeIpAddress(headers.get("x-real-ip")) ?? "direct";
}

const BOT_USER_AGENT_RE =
  /\b(?:curl|wget|python-requests|python-urllib|httpx|aiohttp|go-http-client|libwww-perl|scrapy|sqlmap|nikto|nmap|masscan|nuclei|zgrab|gobuster|dirbuster|ffuf|wfuzz|acunetix|nessus|headlesschrome|phantomjs|selenium|puppeteer|playwright)\b/i;

export type BotCheckOptions = {
  method?: string;
  requireSameOrigin?: boolean;
  allowCrossSiteNavigation?: boolean;
  trustProxyEnabled?: boolean;
  expectedAuthHost?: string;
};

function extractOriginHost(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    return new URL(headerValue).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Server-side bot, scanner, and cross-origin API request check.
 * Returns null when legitimate, or a human-readable block reason for a 403 response.
 */
export function checkBotProtection(
  headers: Pick<Headers, "get">,
  options: BotCheckOptions = {},
): string | null {
  const method = (options.method ?? "GET").toUpperCase();
  const userAgent = (headers.get("user-agent") ?? "").trim();
  if (userAgent.length < 8 || BOT_USER_AGENT_RE.test(userAgent)) {
    return "Automated client requests are not permitted.";
  }

  const secFetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  const secFetchMode = headers.get("sec-fetch-mode")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    const isAllowedNavigation = Boolean(options.allowCrossSiteNavigation && method === "GET" && secFetchMode === "navigate");
    if (!isAllowedNavigation) {
      return "Cross-site requests are not permitted.";
    }
  }

  if (options.requireSameOrigin) {
    const originHost = extractOriginHost(headers.get("origin")) ?? extractOriginHost(headers.get("referer"));
    if (!originHost) {
      return "Request origin header is required.";
    }
    const allowedHosts = new Set<string>();
    const directHost = headers.get("host")?.split(",")[0]?.trim().toLowerCase();
    if (directHost) allowedHosts.add(directHost);
    if (options.trustProxyEnabled ?? trustProxy()) {
      const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
      if (forwardedHost) allowedHosts.add(forwardedHost);
    }
    const authHost = options.expectedAuthHost ?? configuredAuthHost();
    if (authHost) allowedHosts.add(authHost);

    if (!allowedHosts.has(originHost)) {
      return "Cross-origin requests are not permitted.";
    }
  }

  return null;
}

const DEFAULT_CHALLENGE_MIN_AGE_MS = 800;
const DEFAULT_CHALLENGE_MAX_AGE_MS = 15 * 60 * 1000;

function signChallengePayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Issues an HMAC-signed single-use timestamp token for public login forms. */
export function issueBotChallenge(
  nowMilliseconds: number = Date.now(),
  secret: string = authSigningSecret(),
): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${nonce}.${nowMilliseconds}`;
  return `${payload}.${signChallengePayload(payload, secret)}`;
}

/**
 * Verifies honeypot emptiness, HMAC signature, human dwell time, TTL expiry, and single-use replay protection.
 */
export function verifyAndConsumeBotChallenge(input: {
  token: string | undefined;
  honeypot?: string | undefined;
  nowMilliseconds?: number;
  minAgeMilliseconds?: number;
  maxAgeMilliseconds?: number;
  secret?: string;
}): boolean {
  if (input.honeypot && input.honeypot.trim() !== "") return false;
  if (!input.token) return false;

  const parts = input.token.split(".");
  if (parts.length !== 3) return false;
  const [nonce, issuedRaw, signature] = parts;
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^\d{1,16}$/.test(issuedRaw) || !/^[0-9a-f]{64}$/.test(signature)) {
    return false;
  }

  const now = input.nowMilliseconds ?? Date.now();
  const issuedAt = Number(issuedRaw);
  const minAge = input.minAgeMilliseconds ?? DEFAULT_CHALLENGE_MIN_AGE_MS;
  const maxAge = input.maxAgeMilliseconds ?? DEFAULT_CHALLENGE_MAX_AGE_MS;
  const age = now - issuedAt;
  if (!Number.isFinite(age) || age < minAge || age > maxAge) return false;

  const secret = input.secret ?? authSigningSecret();
  const expectedHex = signChallengePayload(`${nonce}.${issuedRaw}`, secret);
  const actualBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return false;
  }

  const current = store();
  sweepExpired(current, now);
  const existingExpiry = current.usedNonces.get(nonce);
  if (existingExpiry && existingExpiry > now) {
    return false; // Replay attempt blocked
  }
  while (current.usedNonces.size >= MAX_NONCES) {
    const oldest = current.usedNonces.keys().next().value;
    if (!oldest) break;
    current.usedNonces.delete(oldest);
  }
  current.usedNonces.set(nonce, issuedAt + maxAge + 5_000);
  return true;
}

