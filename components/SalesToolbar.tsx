"use client";
import { useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LANGUAGE_COOKIE, translator, type Language } from "@/lib/i18n";
import { setLanguageAction } from "@/lib/language-action";
import { link } from "@/lib/url";

// On /sales, sector (an admin sector) narrows the page to its departments. The language button shows on every page; it saves the choice via a Server Action and revalidates in place so cached segments update without a full reload flash.
export function SalesToolbar({ sectors, language }: { sectors: { key: string; name: string }[]; language: Language }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const translate = translator(language);
  const onSales = usePathname().startsWith("/sales");
  const sector = sp.get("s") ?? "", month = sp.get("m");

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const chooseLanguage = () => {
    const next: Language = language === "ar" ? "en" : "ar";
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    startTransition(async () => {
      await setLanguageAction(next);
    });
  };

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {onSales && (
        <label className="ctl">
          <span>{translate("Sector")}</span>{" "}
          <select value={sector} onChange={(e) => router.push(link("/sales", { m: month ?? undefined, s: e.target.value || undefined }))}>
            <option value="">{translate("All sectors")}</option>
            {sectors.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
      )}
      <button
        className="btn"
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={chooseLanguage}
        style={pending ? { opacity: 0.7 } : undefined}
      >
        {language === "ar" ? "English" : "العربية"}
      </button>
    </div>
  );
}
