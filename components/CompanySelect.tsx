"use client";
import { useRouter } from "next/navigation";

/** Company dropdown that keeps the other query params. An "all" value combines every listed company. */
export function CompanySelect({ companies, value, base, allLabel, param = "company", label = "Company" }: { companies: { id: number | string; name: string }[]; value?: number | string; base: string; allLabel?: string; param?: string; label?: string }) {
  const router = useRouter();
  return (
    <label className="ctl">{label}
      <select value={value ?? ""} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}${param}=${e.target.value}`)}>
        {allLabel && <option value="all">{allLabel}</option>}
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
