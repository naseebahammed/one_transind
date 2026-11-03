"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";

// Empty label = use the database name. Overrides only affect display; sales data is untouched.
export async function saveSalesSector(f: FormData) {
  const code = String(f.get("code") ?? "");
  if (!code) return;
  const label = String(f.get("label") ?? "").trim().slice(0, 60) || null;
  await q("INSERT INTO app.sales_departments(code,label,hidden) VALUES($1,$2,COALESCE((SELECT hidden FROM app.sales_departments WHERE code=$1),0)) ON CONFLICT(code) DO UPDATE SET label=excluded.label", [code, label]);
  revalidatePath("/", "layout");
}

// Which admin sector this department's revenue counts under on the home dashboard ("" = unassigned).
export async function assignSalesSector(f: FormData) {
  const code = String(f.get("code") ?? "");
  if (!code) return;
  const sector = String(f.get("sector") ?? "") || null;
  await q("INSERT INTO app.sales_departments(code,sector) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET sector=excluded.sector", [code, sector]);
  revalidatePath("/", "layout");
}

export async function toggleSalesSector(f: FormData) {
  const code = String(f.get("code") ?? "");
  if (!code) return;
  await q("INSERT INTO app.sales_departments(code,hidden) VALUES($1,1) ON CONFLICT(code) DO UPDATE SET hidden=1-app.sales_departments.hidden", [code]);
  revalidatePath("/", "layout");
}
