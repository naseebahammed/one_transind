"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Month dropdown that keeps the other query params. Months after `max` are disabled. With `allLabel`, a first option "all" covers the whole year. */
export function MonthSelect({ value, max, names, year, base, allLabel }: { value: number | "all"; max: number; names: string[]; year?: number; base: string; allLabel?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="ctl" data-pending={pending ? "true" : undefined} aria-busy={pending}>Month
      <select
        value={value}
        onChange={(e) => {
          const next = `${base}${base.includes("?") ? "&" : "?"}m=${e.target.value === "all" ? "all" : +e.target.value + 1}`;
          startTransition(() => router.push(next));
        }}
      >
        {allLabel && <option value="all">{allLabel}</option>}
        {names.map((n, i) => <option key={n} value={i} disabled={i > max}>{year ? `${n} ${year}` : n}</option>)}
      </select>
      {pending && <span className="ctl-spin" aria-hidden="true" />}
    </label>
  );
}
