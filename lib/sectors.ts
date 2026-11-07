import { q, q1 } from "@/lib/db";
import { SECTORS } from "@/lib/org";

export const listSectors = async () =>
  (await q<{ key: string; name: string }>("SELECT key, name FROM app.sectors ORDER BY lower(name)")).map((r) => [r.key, r.name] as [string, string]);

export const countCompanies = async (key: string) =>
  (await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM app.companies WHERE sector=$1", [key]))!.n;

/** Keys hardcoded elsewhere (HR org data, Real Estate pages, dashboard cards) — never deletable from the admin UI. */
export const PROTECTED_SECTOR_KEYS = new Set<string>(SECTORS.map(([key]) => key));
