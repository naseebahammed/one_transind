"use server";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { MAX_PG_INT, parseNonNegativeInt, parsePositiveIntId } from "@/lib/input-validation";
import { inspectLogoUpload, MAX_LOGO_BYTES } from "@/lib/upload-security";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { saveCompanyRecord, setCompanyHidden } from "@/lib/companies";
import { parseCompany } from "@/lib/company-input";
import { REPORTS_CACHE_TAG } from "@/lib/reports";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";

export type FormState = { error?: string };

export async function saveCompany(_: FormState, f: FormData): Promise<FormState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }

  let saved = false;
  try {
    const outcome = await withUploadSlot(admin.email, async () => {
      const id = parseNonNegativeInt(f.get("id"), MAX_PG_INT, true);
      if (id === null) return { error: "Invalid company ID." };
      const [sectors, propertyTypes] = await Promise.all([listSectors(), listPropertyTypes()]);
      const parsed = parseCompany(f, sectors.map(([k]) => k), propertyTypes.map(([k]) => k));
      if ("error" in parsed) return parsed;
      const logoFile = f.get("logo");
      const logo = logoFile instanceof File && logoFile.size > 0 ? logoFile : null;
      let logoData: { buf: Buffer; type: string } | null = null;
      if (logo) {
        if (logo.size > MAX_LOGO_BYTES) return { error: "Logo must be under 2MB." };
        const buf = Buffer.from(await logo.arrayBuffer());
        const verifiedLogo = inspectLogoUpload(buf, MAX_LOGO_BYTES);
        if (!verifiedLogo.ok) return { error: verifiedLogo.error };
        logoData = { buf, type: verifiedLogo.mimeType };
      }
      const res = await saveCompanyRecord(id, parsed.data, logoData);
      if (res.error) return res;
      saved = true;
      return {};
    });
    if (outcome.error) return outcome;
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  if (saved) {
    updateTag(REPORTS_CACHE_TAG);
    revalidatePath("/", "layout");
    redirect("/admin/companies");
  }
  return {};
}

/** Sets whether a company's data is hidden on the finance page ("hidden" = 1 or 0); the company record itself is untouched. Absolute, not a flip, so a double submit is harmless. */
export async function toggleCompanyHidden(f: FormData) {
  await requireAdmin("mutation");
  const id = parsePositiveIntId(f.get("id"));
  if (!id) return;
  await setCompanyHidden(id, f.get("hidden") === "1" ? 1 : 0);
  updateTag(REPORTS_CACHE_TAG);
  revalidatePath("/", "layout");
}
