"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { requireUser } from "@/lib/guard";
import { LANGUAGE_COOKIE, type Language } from "@/lib/i18n";
import { checkBotProtection, checkMultiRateLimit, extractClientIp } from "@/lib/rate-limit";

const MINUTE_MS = 60_000;
const YEAR_SECONDS = 31_536_000;

export async function setLanguageAction(nextLanguage: Language): Promise<void> {
  const user = await requireUser();
  const requestHeaders = await headers();
  const botError = checkBotProtection(requestHeaders, { method: "POST", requireSameOrigin: true });
  if (botError) return;

  const clientIp = extractClientIp(requestHeaders);
  const decision = checkMultiRateLimit([
    { key: `user:language:min:${user.email}`, maxRequests: 30, windowMilliseconds: MINUTE_MS },
    { key: `ip:language:min:${clientIp}`, maxRequests: 60, windowMilliseconds: MINUTE_MS },
  ]);
  if (!decision.allowed) return;

  const lang: Language = nextLanguage === "ar" ? "ar" : "en";
  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_COOKIE, lang, {
    path: "/",
    maxAge: YEAR_SECONDS,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
