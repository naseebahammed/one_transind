import { cacheLife, cacheTag } from "next/cache";
import { q, q1 } from "@/lib/db";
import { SECTOR, SECTORS } from "@/lib/org";

export const SECTORS_CACHE_TAG = "sectors";

export async function listSectors() {
  "use cache";
  cacheTag(SECTORS_CACHE_TAG);
  cacheLife("hours");
  return (await q<{ key: string; name: string }>("SELECT key, name FROM app.sectors ORDER BY lower(name)")).map((r) => [r.key, r.name] as [string, string]);
}

/** Sectors that already have their own menu page; every other admin sector gets the generic /sectors/[key] page. */
const OWN_PAGE_KEYS = new Set<string>([SECTOR.realEstate, SECTOR.retail, SECTOR.healthBeauty, SECTOR.logistics, SECTOR.foodBeverage, SECTOR.trading]);

export const listMenuSectors = async () =>
  (await listSectors()).filter(([key, name]) => !OWN_PAGE_KEYS.has(key) && !/^corporate holding$/i.test(name)).map(([key, name]) => ({ key, name }));

export const countCompanies = async (key: string) =>
  (await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM app.companies WHERE sector=$1", [key]))!.n;

/** Keys hardcoded elsewhere (HR org data, Real Estate pages, dashboard cards) — never deletable from the admin UI. */
export const PROTECTED_SECTOR_KEYS = new Set<string>(SECTORS.map(([key]) => key));

export async function createSector(name: string): Promise<{ error?: string }> {
  if (await q1("SELECT 1 FROM app.sectors WHERE lower(name)=lower($1)", [name])) return { error: "A sector with this name already exists." };
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "sector";
  let key = base;
  for (let i = 2; await q1("SELECT 1 FROM app.sectors WHERE key=$1", [key]); i++) key = `${base}-${i}`;
  await q("INSERT INTO app.sectors(key,name) VALUES($1,$2)", [key, name]);
  return {};
}

export async function renameSectorByKey(key: string, name: string): Promise<{ error?: string }> {
  if (await q1("SELECT 1 FROM app.sectors WHERE lower(name)=lower($1) AND key<>$2", [name, key])) return { error: "A sector with this name already exists." };
  await q("UPDATE app.sectors SET name=$1 WHERE key=$2", [name, key]);
  return {};
}

export async function removeSector(key: string) {
  if (PROTECTED_SECTOR_KEYS.has(key)) return; // built into the app; UI disables the button, this guards a forged request
  if (await countCompanies(key)) return; // UI disables the button; this guards a forged request
  await q("DELETE FROM app.sectors WHERE key=$1", [key]);
}
