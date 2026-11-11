import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { checkBotProtection, checkMultiRateLimit, extractClientIp, rateLimitResponse } from "@/lib/rate-limit";

const MINUTE = 60_000;
const MAX_AUTH_POST_BYTES = 16_384;

export async function GET(req: NextRequest) {
  const botError = checkBotProtection(req.headers, {
    method: "GET",
    allowCrossSiteNavigation: true, // permits top-level redirect back from Microsoft Entra ID
  });
  if (botError) {
    return Response.json({ error: botError }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const clientIp = extractClientIp(req.headers);
  const decision = checkMultiRateLimit([
    { key: `ip:auth-get:min:${clientIp}`, maxRequests: 60, windowMilliseconds: MINUTE },
    { key: "global:auth-get:min", maxRequests: 240, windowMilliseconds: MINUTE },
  ]);
  if (!decision.allowed) return rateLimitResponse(decision, "Too many authentication requests. Please wait a moment.");

  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const botError = checkBotProtection(req.headers, {
    method: "POST",
    requireSameOrigin: true,
  });
  if (botError) {
    return Response.json({ error: botError }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_POST_BYTES) {
    return Response.json({ error: "Request payload is too large." }, { status: 413 });
  }

  const clientIp = extractClientIp(req.headers);
  const decision = checkMultiRateLimit([
    { key: `ip:auth-post:min:${clientIp}`, maxRequests: 10, windowMilliseconds: MINUTE },
    { key: "global:auth-post:min", maxRequests: 30, windowMilliseconds: MINUTE },
  ]);
  if (!decision.allowed) return rateLimitResponse(decision, "Too many sign-in attempts. Please wait a minute and try again.");

  return handlers.POST(req);
}
