"use client";
import { useRouter } from "next/navigation";

/** Year dropdown that keeps the other query params. */
export function YearSelect({ years, value, base }: { years: number[]; value?: number; base: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Year
      <select value={value ?? ""} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}year=${e.target.value}`)}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
