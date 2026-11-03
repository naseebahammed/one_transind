"use client";
import { useRouter } from "next/navigation";

/** Company dropdown that keeps the other query params. */
export function CompanySelect({ companies, value, base }: { companies: { id: number; name: string }[]; value?: number; base: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Company
      <select value={value ?? ""} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}company=${e.target.value}`)}>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
