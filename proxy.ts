import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkBotProtection, checkMultiRateLimit, extractClientIp, rateLimitResponse } from "@/lib/rate-limit";

const MINUTE = 60_000;

// Cookie check + edge bot/flood shield (no database): the approved-list and per-user limits run in lib/guard.ts on every page, route and action.
export default auth((req) => {
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (isApi) {
    const botError = checkBotProtection(req.headers, {
      method: req.method,
      requireSameOrigin: req.method !== "GET" && req.method !== "HEAD",
    });
    if (botError) {
      return NextResponse.json({ error: botError }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (req.auth) return;

  if (isApi) {
    const clientIp = extractClientIp(req.headers);
    const probeDecision = checkMultiRateLimit([
      { key: `ip:api-unauth:min:${clientIp}`, maxRequests: 30, windowMilliseconds: MINUTE },
      { key: "global:api-unauth:min", maxRequests: 120, windowMilliseconds: MINUTE },
    ]);
    if (!probeDecision.allowed) return rateLimitResponse(probeDecision);
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/signin", req.nextUrl));
});

export const config = {
  matcher: ["/((?!api/auth(?:/|$)|_next/|signin(?:/|$)|no-access(?:/|$)|icon\\.svg$|favicon\\.ico$|(?!(?:api|admin)(?:/|$)).*\\.(?:webp|png|jpg|jpeg|svg|ico)$).*)"],
};
