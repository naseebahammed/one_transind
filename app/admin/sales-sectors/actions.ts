"use server";
import { requireAdmin } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { setSalesDepartmentLabel, setSalesDepartmentSector, toggleSalesDepartmentHidden } from "@/lib/sales-sectors";

// Empty label = use the database name. Overrides only affect display; sales data is untouched.
export async function saveSalesSector(f: FormData) {
  await requireAdmin();
  const code = String(f.get("code") ?? "");
  if (!code) return;
  const label = String(f.get("label") ?? "").trim().slice(0, 60) || null;
  await setSalesDepartmentLabel(code, label);
  revalidatePath("/", "layout");
}

// Which admin sector this department's revenue counts under on the home dashboard ("" = unassigned).
export async function assignSalesSector(f: FormData) {
  await requireAdmin();
  const code = String(f.get("code") ?? "");
  if (!code) return;
  const sector = String(f.get("sector") ?? "") || null;
  await setSalesDepartmentSector(code, sector);
  revalidatePath("/", "layout");
}

export async function toggleSalesSector(f: FormData) {
  await requireAdmin();
  const code = String(f.get("code") ?? "");
  if (!code) return;
  await toggleSalesDepartmentHidden(code);
  revalidatePath("/", "layout");
}
