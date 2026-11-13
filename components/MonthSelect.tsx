"use client";
import { useRouter } from "next/navigation";

/** Month dropdown that keeps the other query params. Months after `max` are disabled. An empty `value` shows a dash (another filter, such as a quarter, is in use). With `allLabel`, a first option "all" covers the whole year. */
export function MonthSelect({ value, max, names, year, base, allLabel }: { value: number | "all" | ""; max: number; names: string[]; year?: number; base: string; allLabel?: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Month
      <select value={value} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}m=${e.target.value === "all" ? "all" : +e.target.value + 1}`)}>
        {value === "" && <option value="" disabled hidden>—</option>}
        {allLabel && <option value="all">{allLabel}</option>}
        {names.map((n, i) => <option key={n} value={i} disabled={i > max}>{year ? `${n} ${year}` : n}</option>)}
      </select>
    </label>
  );
}
