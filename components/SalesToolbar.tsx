"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { link } from "@/lib/url";

const ROLES = ["Group management", "CFO", "FMCG sector manager", "Sales rep", "HR", "Logistics manager"];

// Sector (an admin sector) narrows the page to its departments; role and language are display-only for now.
export function SalesToolbar({ sectors }: { sectors: { key: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [ar, setAr] = useState(false);
  if (!usePathname().startsWith("/sales")) return null;
  const sector = sp.get("s") ?? "", month = sp.get("m");
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label className="ctl">
        <span>Sector</span>{" "}
        <select value={sector} onChange={(e) => router.push(link("/sales", { m: month ?? undefined, s: e.target.value || undefined }))}>
          <option value="">All sectors</option>
          {sectors.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
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
