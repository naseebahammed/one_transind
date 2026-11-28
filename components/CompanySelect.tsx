"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Company dropdown that keeps the other query params. An "all" value combines every listed company. */
export function CompanySelect({ companies, value, base, allLabel, param = "company", label = "Company" }: { companies: { id: number | string; name: string }[]; value?: number | string; base: string; allLabel?: string; param?: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="ctl" data-pending={pending ? "true" : undefined} aria-busy={pending}>{label}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const next = `${base}${base.includes("?") ? "&" : "?"}${param}=${e.target.value}`;
          startTransition(() => router.push(next));
        }}
      >
        {allLabel && <option value="all">{allLabel}</option>}
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {pending && <span className="ctl-spin" aria-hidden="true" />}
    </label>
  );
}
