"use client";
import { useRouter } from "next/navigation";

/** Year dropdown that keeps the other query params. With `allLabel`, a first option "all" covers every year. */
export function YearSelect({ years, value, base, allLabel }: { years: number[]; value?: number | "all"; base: string; allLabel?: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Year
      <select value={value ?? ""} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}year=${e.target.value}`)}>
        {allLabel && <option value="all">{allLabel}</option>}
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
