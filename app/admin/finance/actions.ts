"use server";
import { revalidatePath } from "next/cache";
import { readWorkbook, gridFromWorkbook, MAX_UPLOAD_BYTES } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { parseSupplierAgeing } from "@/lib/supplier-ageing";
import { saveSupplierAgeing } from "@/lib/supplier-ageing-records";
import { sanitizeUploadFileName } from "@/lib/upload-security";

export type SupplierAgeingUploadState = { error?: string; ok?: string };

/** Reads the Supplier Ageing Report (one file) for the report date typed in the form. Any bad row refuses the file; rows already on file for that date are replaced. */
export async function uploadSupplierAgeing(_: SupplierAgeingUploadState, f: FormData): Promise<SupplierAgeingUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  try {
    return await withUploadSlot(admin.email, async () => {
      const file = f.get("file"), asOf = String(f.get("asOf") ?? "");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? new Date(`${asOf}T00:00:00Z`) : null;
      if (!date || isNaN(+date) || date.toISOString().slice(0, 10) !== asOf || asOf > new Date().toISOString().slice(0, 10)) return { error: "Choose the report date (not in the future)." };
      if (!(file instanceof File) || !file.size) return { error: "Choose the supplier ageing .xlsx file." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB. Copy the sheet as values into a new workbook and upload that." };
      try {
        const { rows, errors } = parseSupplierAgeing(gridFromWorkbook(await readWorkbook(Buffer.from(await file.arrayBuffer()))));
        if (errors.length) throw new Error(`${sanitizeUploadFileName(file.name)}: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` (and ${errors.length - 5} more)` : ""}`);
        const n = await saveSupplierAgeing(asOf, rows);
        await addLog("Supplier ageing uploaded", true, n);
        revalidatePath("/finance/payables"); revalidatePath("/admin/activity");
        return { ok: `Saved ${n} supplier accounts as of ${asOf}.` };
      } catch (e) {
        await addLog("Supplier ageing rejected", false, 0);
        revalidatePath("/admin/activity");
        return { error: (e as Error).message };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}
