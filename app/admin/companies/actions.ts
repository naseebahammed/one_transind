"use server";
import { requireAdmin } from "@/lib/guard";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveCompanyRecord, setCompanyHidden } from "@/lib/companies";
import { SAFE_LOGO_TYPES } from "@/lib/companies.shared";
import { parseCompany } from "@/lib/company-input";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";

export type FormState = { error?: string };

export async function saveCompany(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const rawId = f.get("id");
  const id = rawId ? Number(rawId) : 0;
  if (!Number.isInteger(id) || id < 0) return { error: "Invalid company ID." };
  const [sectors, propertyTypes] = await Promise.all([listSectors(), listPropertyTypes()]);
  const parsed = parseCompany(f, sectors.map(([k]) => k), propertyTypes.map(([k]) => k));
  if ("error" in parsed) return parsed;
  const logoFile = f.get("logo");
  const logo = logoFile instanceof File && logoFile.size > 0 ? logoFile : null;
  if (logo && !SAFE_LOGO_TYPES.has(logo.type)) return { error: "Logo must be a PNG, JPEG, WebP, GIF or SVG image." };
  if (logo && logo.size > 2 * 1024 * 1024) return { error: "Logo must be under 2MB." };
  const logoData = logo ? { buf: Buffer.from(await logo.arrayBuffer()), type: logo.type } : null;
  const res = await saveCompanyRecord(id, parsed.data, logoData);
  if (res.error) return res;
  revalidatePath("/", "layout");
  redirect("/admin/companies");
}

/** Sets whether a company's data is hidden on the finance page ("hidden" = 1 or 0); the company record itself is untouched. Absolute, not a flip, so a double submit is harmless. */
export async function toggleCompanyHidden(f: FormData) {
  await requireAdmin();
  const id = Number(f.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await setCompanyHidden(id, f.get("hidden") === "1" ? 1 : 0);
  revalidatePath("/", "layout");
}
