"use server";
import { requireAdmin } from "@/lib/guard";
import { cleanText, parseSlugKey } from "@/lib/input-validation";
import { revalidatePath, updateTag } from "next/cache";
import { setSalesDepartmentLabel, setSalesDepartmentSector, toggleSalesDepartmentHidden } from "@/lib/sales-sectors";
import { SALES_CACHE_TAG } from "@/lib/sales-targets";
import { listSectors } from "@/lib/sectors";

// Empty label = use the database name. Overrides only affect display; sales data is untouched.
export async function saveSalesSector(f: FormData) {
  await requireAdmin("mutation");
  const code = cleanText(f.get("code"), 80);
  if (!code) return;
  const label = cleanText(f.get("label"), 60) || null;
  await setSalesDepartmentLabel(code, label);
  updateTag(SALES_CACHE_TAG);
  revalidatePath("/", "layout");
}

// Which admin sector this department's revenue counts under on the home dashboard ("" = unassigned).
export async function assignSalesSector(f: FormData) {
  await requireAdmin("mutation");
  const code = cleanText(f.get("code"), 80);
  if (!code) return;
  const rawSector = cleanText(f.get("sector"), 40);
  const sector = rawSector ? parseSlugKey(rawSector) : null;
  if (rawSector && !sector) return;
  if (sector && !(await listSectors()).some(([k]) => k === sector)) return;
  await setSalesDepartmentSector(code, sector);
  updateTag(SALES_CACHE_TAG);
  revalidatePath("/", "layout");
}

export async function toggleSalesSector(f: FormData) {
  await requireAdmin("mutation");
  const code = cleanText(f.get("code"), 80);
  if (!code) return;
  await toggleSalesDepartmentHidden(code);
  updateTag(SALES_CACHE_TAG);
  revalidatePath("/", "layout");
}
