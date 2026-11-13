import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, type Language } from "./i18n";

/** The language the visitor chose with the toolbar button; English until they pick Arabic. */
export async function getLanguage(): Promise<Language> {
  return (await cookies()).get(LANGUAGE_COOKIE)?.value === "ar" ? "ar" : "en";
}
