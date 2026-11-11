import { createHmac, timingSafeEqual } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("lib/webhook-signature.ts is server-only and must never run in the browser.");
}

const DEFAULT_TOLERANCE_SECONDS = 300;
const MAX_PROCESSED_EVENTS = 5_000;

const globalWebhookState = globalThis as unknown as { _processedWebhookEvents?: Map<string, number> };

function processedStore(): Map<string, number> {
  return (globalWebhookState._processedWebhookEvents ??= new Map());
}

/** Clears replay state for isolated unit tests. */
export function resetWebhookReplayState() {
  processedStore().clear();
}

export type WebhookVerificationInput = {
  /** Exact raw UTF-8 request body bytes/string before JSON parsing. */
  rawBody: string | Buffer;
  /** Header value in `t=<unix_seconds>,v1=<hex_hmac_sha256>` format. */
  signatureHeader: string | null | undefined;
  /** Server-side webhook signing secret (never exposed to client code). */
  secret: string | undefined;
  /** Optional unique event ID to enforce idempotent single-delivery processing within tolerance. */
  eventId?: string;
  /** Maximum clock skew / replay window in seconds (default 300s = 5 minutes). */
  toleranceSeconds?: number;
  nowMilliseconds?: number;
};

/** Computes an `t=<epoch>,v1=<hmac>` signature header over `<timestamp>.<rawBody>` (for tests and internal emitters). */
export function signWebhookPayload(rawBody: string | Buffer, secret: string, timestampSeconds: number): string {
  const hmac = createHmac("sha256", secret)
    .update(`${timestampSeconds}.`)
    .update(rawBody)
    .digest("hex");
  return `t=${timestampSeconds},v1=${hmac}`;
}

/**
 * Verifies an inbound signed webhook (payment gateway or ERP push) using HMAC-SHA256 over the exact raw payload,
 * constant-time digest comparison, timestamp replay bounds, and optional event-id deduplication.
 */
export function verifyWebhookSignature(input: WebhookVerificationInput): { ok: true } | { ok: false; error: string } {
  const secret = input.secret?.trim();
  if (!secret) return { ok: false, error: "Webhook signing secret is not configured." };
  if (!input.signatureHeader) return { ok: false, error: "Missing webhook signature header." };

  let timestampRaw = "";
  const signatures: string[] = [];
  for (const part of input.signatureHeader.split(",")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key === "t") timestampRaw = val;
    else if (key === "v1" && /^[0-9a-f]{64}$/i.test(val)) signatures.push(val.toLowerCase());
  }

  if (!/^\d{1,12}$/.test(timestampRaw) || signatures.length === 0) {
    return { ok: false, error: "Malformed webhook signature header." };
  }

  const nowSeconds = Math.floor((input.nowMilliseconds ?? Date.now()) / 1000);
  const timestampSeconds = Number(timestampRaw);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    return { ok: false, error: "Webhook timestamp is outside the allowed tolerance window." };
  }

  const expectedHex = createHmac("sha256", secret)
    .update(`${timestampRaw}.`)
    .update(input.rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  const matched = signatures.some((candidateHex) => {
    const candidateBuf = Buffer.from(candidateHex, "hex");
    return candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf);
  });
  if (!matched) {
    return { ok: false, error: "Webhook signature verification failed." };
  }

  if (input.eventId) {
    const store = processedStore();
    for (const [id, expiresAt] of store) {
      if (expiresAt <= nowSeconds) store.delete(id);
    }
    const existing = store.get(input.eventId);
    if (existing && existing > nowSeconds) {
      return { ok: false, error: "Duplicate webhook event replay rejected." };
    }
    while (store.size >= MAX_PROCESSED_EVENTS) {
      const oldest = store.keys().next().value;
      if (!oldest) break;
      store.delete(oldest);
    }
    store.set(input.eventId, nowSeconds + tolerance + 60);
  }

  return { ok: true };
}
