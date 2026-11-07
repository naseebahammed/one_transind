import { connection } from "next/server";
import { q } from "@/lib/db";
import { getSectors } from "@/lib/data";

type Override = { code: string; label: string | null; hidden: number; sector: string | null };
export const listOverrides = () => q<Override>("SELECT code, label, hidden, sector FROM app.sales_departments");

/** Sales departments from Postgres with the admin's rename/hide overrides applied (hidden ones dropped unless `all`). */
export async function getSalesSectors(all = false) {
  await connection(); // overrides live in Postgres and must not be baked in at build time
  const ov = new Map((await listOverrides()).map((o) => [o.code, o]));
  return (await getSectors())
    .filter((s) => all || !ov.get(s.key)?.hidden)
    .map((s) => ({ ...s, label: ov.get(s.key)?.label || s.label, sector: ov.get(s.key)?.sector ?? null }));
}
