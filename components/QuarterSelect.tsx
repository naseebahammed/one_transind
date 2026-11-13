"use client";
import { useRouter } from "next/navigation";

/** Quarter dropdown that keeps the other query params. Quarters after `max` (1-4) are disabled; an empty `value` shows a dash (a month is in use). */
export function QuarterSelect({ value, max, base }: { value: number | ""; max: number; base: string }) {
  const router = useRouter();
  return (
    <label className="ctl">Quarter
      <select value={value} onChange={(e) => router.push(`${base}${base.includes("?") ? "&" : "?"}qt=${e.target.value}`)}>
        {value === "" && <option value="" disabled hidden>—</option>}
        {[1, 2, 3, 4].map((n) => <option key={n} value={n} disabled={n > max}>Q{n}</option>)}
      </select>
    </label>
  );
}
