import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiStatus, type Role } from "@/lib/access";
import { currentRole } from "@/lib/current-role";
import {
  acquireConcurrency,
  checkBotProtection,
  checkMultiRateLimit,
  extractClientIp,
  rateLimitResponse,
  type ConcurrencyRule,
  type RateLimitRule,
} from "@/lib/rate-limit";
import { isListedEmail } from "@/lib/users";

if (typeof window !== "undefined") {
  throw new Error("lib/guard.ts is server-only and must never run in the browser.");
}

export type ApiBucket = "ask" | "template" | "importDownload" | "logo";
export type ActionKind = "upload" | "mutation";

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MAX_ASK_BODY_BYTES = 8_192;

const who = cache(async () => {
  const session = await auth();
  const email = session?.user?.email;
  const name = session?.user?.name;
  return { email, name, role: await currentRole(email, isListedEmail) };
});

function apiBucketRules(bucket: ApiBucket, email: string, clientIp: string): {
  rateRules: RateLimitRule[];
  concurrencyRules: ConcurrencyRule[];
  limitMessage: string;
} {
  if (bucket === "ask") {
    return {
      rateRules: [
        { key: `user:ask:min:${email}`, maxRequests: 10, windowMilliseconds: MINUTE },
        { key: `user:ask:hour:${email}`, maxRequests: 60, windowMilliseconds: HOUR },
        { key: `ip:ask:min:${clientIp}`, maxRequests: 15, windowMilliseconds: MINUTE },
        { key: "global:ask:min", maxRequests: 30, windowMilliseconds: MINUTE },
      ],
      concurrencyRules: [
        { key: `conc:ask:user:${email}`, maxConcurrent: 1 },
        { key: "conc:ask:global", maxConcurrent: 4 },
      ],
      limitMessage: "Too many questions in a short time. Please wait a moment and try again.",
    };
  }
  if (bucket === "template") {
    return {
      rateRules: [
        { key: `user:template:min:${email}`, maxRequests: 20, windowMilliseconds: MINUTE },
        { key: "global:template:min", maxRequests: 60, windowMilliseconds: MINUTE },
      ],
      concurrencyRules: [
        { key: `conc:template:user:${email}`, maxConcurrent: 2 },
        { key: "conc:template:global", maxConcurrent: 5 },
      ],
      limitMessage: "Too many template downloads. Please wait a moment and try again.",
    };
  }
  if (bucket === "importDownload") {
    return {
      rateRules: [
        { key: `user:importDownload:min:${email}`, maxRequests: 30, windowMilliseconds: MINUTE },
        { key: "global:importDownload:min", maxRequests: 60, windowMilliseconds: MINUTE },
      ],
      concurrencyRules: [
        { key: `conc:importDownload:user:${email}`, maxConcurrent: 2 },
        { key: "conc:importDownload:global", maxConcurrent: 5 },
      ],
      limitMessage: "Too many file downloads. Please wait a moment and try again.",
    };
  }
  return {
    rateRules: [
      { key: `user:logo:min:${email}`, maxRequests: 120, windowMilliseconds: MINUTE },
      { key: "global:logo:min", maxRequests: 300, windowMilliseconds: MINUTE },
    ],
    concurrencyRules: [
      { key: `conc:logo:user:${email}`, maxConcurrent: 6 },
      { key: "conc:logo:global", maxConcurrent: 15 },
    ],
    limitMessage: "Too many image requests. Please wait a moment and try again.",
  };
}

/** Call first in every page, layout and Server Action. The list is re-read each time, so removing someone takes effect on their next request. */
export async function requireUser() {
  const { email, name, role } = await who();
  if (!email) redirect("/signin");
  if (!role) redirect("/no-access");
  return { email, name, role };
}

/**
 * Verifies admin role. When `actionKind` is passed (all Server Actions), also enforces server-side bot protection and mutation/upload rate limits.
 */
export async function requireAdmin(actionKind?: ActionKind) {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/no-access");

  if (actionKind) {
    const requestHeaders = await headers();
    const botError = checkBotProtection(requestHeaders, { method: "POST", requireSameOrigin: true });
    if (botError) throw new GuardError(botError);

    const rules: RateLimitRule[] =
      actionKind === "upload"
        ? [
            { key: `user:action-upload:min:${user.email}`, maxRequests: 12, windowMilliseconds: MINUTE },
            { key: `user:action-upload:hour:${user.email}`, maxRequests: 60, windowMilliseconds: HOUR },
            { key: "global:action-upload:min", maxRequests: 24, windowMilliseconds: MINUTE },
          ]
        : [
            { key: `user:action-mutation:min:${user.email}`, maxRequests: 60, windowMilliseconds: MINUTE },
            { key: "global:action-mutation:min", maxRequests: 180, windowMilliseconds: MINUTE },
          ];
    const decision = checkMultiRateLimit(rules);
    if (!decision.allowed) {
      throw new GuardError("Too many actions in a short time. Please wait a moment and try again.");
    }
  }

  return user;
}

/** Caps simultaneous heavy workbook/file uploads in flight per admin and across the server. */
export async function withUploadSlot<T>(email: string, run: () => Promise<T>): Promise<T> {
  const release = acquireConcurrency([
    { key: `conc:upload:user:${email}`, maxConcurrent: 1 },
    { key: "conc:upload:global", maxConcurrent: 2 },
  ]);
  if (!release) {
    throw new GuardError("Another upload is still processing. Please wait for it to finish.");
  }
  try {
    return await run();
  } finally {
    release();
  }
}

/** Guards public Server Actions on /signin and /no-access against bot/CLI posts and request floods. */
export async function allowPublicAction(bucket: "signin" | "signout"): Promise<boolean> {
  const requestHeaders = await headers();
  const botError = checkBotProtection(requestHeaders, { method: "POST", requireSameOrigin: true });
  if (botError) return false;

  const clientIp = extractClientIp(requestHeaders);
  const decision = checkMultiRateLimit([
    { key: `ip:public-${bucket}:min:${clientIp}`, maxRequests: bucket === "signin" ? 10 : 20, windowMilliseconds: MINUTE },
    { key: `global:public-${bucket}:min`, maxRequests: bucket === "signin" ? 30 : 60, windowMilliseconds: MINUTE },
  ]);
  return decision.allowed;
}

/**
 * Wraps every API route handler with bot protection, payload checks, pre-auth flood protection,
 * session + role verification, non-bypassable user/global rate limits, and in-flight concurrency caps.
 */
export async function apiGuard(
  req: Request,
  need: Role,
  bucket: ApiBucket,
  run: () => Promise<Response>,
): Promise<Response> {
  const method = req.method.toUpperCase();
  const isStateChanging = method !== "GET" && method !== "HEAD";

  const botError = checkBotProtection(req.headers, {
    method,
    requireSameOrigin: isStateChanging,
  });
  if (botError) {
    return Response.json({ error: botError }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  if (bucket === "ask") {
    const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return Response.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_ASK_BODY_BYTES) {
      return Response.json({ error: "Request payload is too large." }, { status: 413 });
    }
  }

  const clientIp = extractClientIp(req.headers);
  const preAuth = checkMultiRateLimit([
    { key: `ip:api-preauth:min:${clientIp}`, maxRequests: 180, windowMilliseconds: MINUTE },
    { key: "global:api-preauth:min", maxRequests: 600, windowMilliseconds: MINUTE },
  ]);
  if (!preAuth.allowed) return rateLimitResponse(preAuth);

  const { email, role } = await who();
  const status = apiStatus(email, role, need);
  if (status === 401) {
    const unauthProbe = checkMultiRateLimit([
      { key: `ip:api-unauth:min:${clientIp}`, maxRequests: 30, windowMilliseconds: MINUTE },
      { key: "global:api-unauth:min", maxRequests: 120, windowMilliseconds: MINUTE },
    ]);
    if (!unauthProbe.allowed) return rateLimitResponse(unauthProbe);
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (status === 403 || !email) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rateRules, concurrencyRules, limitMessage } = apiBucketRules(bucket, email, clientIp);
  const rateDecision = checkMultiRateLimit(rateRules);
  if (!rateDecision.allowed) {
    return rateLimitResponse(rateDecision, limitMessage);
  }

  const release = acquireConcurrency(concurrencyRules);
  if (!release) {
    return Response.json(
      { error: "Another request is still finishing. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "3", "Cache-Control": "no-store" } },
    );
  }

  try {
    return await run();
  } finally {
    release();
  }
}
