"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const ROLES = ["Group management", "CFO", "FMCG sector manager", "Sales rep", "HR", "Logistics manager"];

// Sector drives the page's department filter; role and language are display-only for now.
export function SalesToolbar({ sectors }: { sectors: { key: string; label: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [ar, setAr] = useState(false);
  if (!usePathname().startsWith("/sales")) return null;
  const dept = (sp.get("p") ?? "").split("|")[0], month = sp.get("m");
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label className="ctl">
        <span>Sector</span>{" "}
        <select value={dept} onChange={(e) => router.push(`/sales?${month ? `m=${month}&` : ""}${e.target.value ? `p=${encodeURIComponent(e.target.value)}` : ""}`)}>
          <option value="">All sectors</option>
          {sectors.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
      <label className="ctl">
        <span>Role</span>{" "}
        <select defaultValue={ROLES[0]}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
      </label>
      <button className="btn" type="button" onClick={() => setAr(!ar)}>{ar ? "English" : "العربية"}</button>
    </div>
  );
}
