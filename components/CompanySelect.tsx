"use client";
import { useRouter } from "next/navigation";

/** Company dropdown that keeps the other query params. An "all" value combines every listed company. */
export function CompanySelect({ companies, value, base, allLabel }: { companies: { id: number; name: string }[]; value?: number | "all"; base: string; allLabel?: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Company
      <select value={value ?? ""} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}company=${e.target.value}`)}>
        {allLabel && <option value="all">{allLabel}</option>}
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
