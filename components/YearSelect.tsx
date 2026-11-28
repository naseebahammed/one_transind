"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Year dropdown that keeps the other query params. With `allLabel`, a first option "all" covers every year. */
export function YearSelect({ years, value, base, allLabel }: { years: number[]; value?: number | "all"; base: string; allLabel?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="ctl" data-pending={pending ? "true" : undefined} aria-busy={pending}>Year
      <select
        value={value ?? ""}
        onChange={(e) => {
          const next = `${base}${base.includes("?") ? "&" : "?"}year=${e.target.value}`;
          startTransition(() => router.push(next));
        }}
      >
        {allLabel && <option value="all">{allLabel}</option>}
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      {pending && <span className="ctl-spin" aria-hidden="true" />}
    </label>
  );
}
