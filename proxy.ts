import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Cookie check only (no database): the approved-list check happens in lib/guard.ts on every page, route and action.
export default auth((req) => {
  if (req.auth) return;
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.redirect(new URL("/signin", req.nextUrl));
});

export const config = {
  matcher: ["/((?!api/auth(?:/|$)|_next/|signin(?:/|$)|no-access(?:/|$)|icon\\.svg$|favicon\\.ico$|(?!(?:api|admin)(?:/|$)).*\\.(?:webp|png|jpg|jpeg|svg|ico)$).*)"],
};
