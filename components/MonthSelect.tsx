"use client";
import { useRouter } from "next/navigation";

/** Month dropdown that keeps the other query params. Months after `max` are disabled. */
export function MonthSelect({ value, max, names, year, base }: { value: number; max: number; names: string[]; year: number; base: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Month
      <select value={value} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}m=${+e.target.value + 1}`)}>
        {names.map((n, i) => <option key={n} value={i} disabled={i > max}>{n} {year}</option>)}
      </select>
    </label>
  );
}
