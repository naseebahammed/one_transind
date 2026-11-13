import { cacheLife, cacheTag } from "next/cache";
import { q } from "@/lib/db";
import { getSectors } from "@/lib/data";
import { SALES_CACHE_TAG } from "@/lib/sales-targets";

type Override = { code: string; label: string | null; hidden: number; sector: string | null };
export async function listOverrides() {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  return q<Override>("SELECT code, label, hidden, sector FROM app.sales_departments");
}

/** Sales departments from Postgres with the admin's rename/hide overrides applied (hidden ones dropped unless `all`). */
export async function getSalesSectors(all = false) {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  const [overrides, sectors] = await Promise.all([listOverrides(), getSectors()]);
  const ov = new Map(overrides.map((o) => [o.code, o]));
  return sectors
    .filter((s) => all || !ov.get(s.key)?.hidden)
    .map((s) => ({ ...s, label: ov.get(s.key)?.label || s.label, sector: ov.get(s.key)?.sector ?? null }));
}

export const setSalesDepartmentLabel = (code: string, label: string | null) =>
  q("INSERT INTO app.sales_departments(code,label,hidden) VALUES($1,$2,COALESCE((SELECT hidden FROM app.sales_departments WHERE code=$1),0)) ON CONFLICT(code) DO UPDATE SET label=excluded.label", [code, label]);

export const setSalesDepartmentSector = (code: string, sector: string | null) =>
  q("INSERT INTO app.sales_departments(code,sector) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET sector=excluded.sector", [code, sector]);

export const toggleSalesDepartmentHidden = (code: string) =>
  q("INSERT INTO app.sales_departments(code,hidden) VALUES($1,1) ON CONFLICT(code) DO UPDATE SET hidden=1-app.sales_departments.hidden", [code]);
