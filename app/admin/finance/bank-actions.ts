"use server";
import { revalidatePath } from "next/cache";
import { readWorkbook, sheetsFromWorkbook, MAX_UPLOAD_BYTES } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { parseBankPosition, pickBankPositionSheet } from "@/lib/bank-position";
import { saveBankPosition } from "@/lib/bank-position-records";
import { sanitizeUploadFileName } from "@/lib/upload-security";

export type BankPositionUploadState = { error?: string; ok?: string };

/** Reads the Bank Position sheet (the date comes from the sheet itself). Any bad row refuses the file; rows already on file for that date are replaced. */
export async function uploadBankPosition(_: BankPositionUploadState, f: FormData): Promise<BankPositionUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  try {
    return await withUploadSlot(admin.email, async () => {
      const file = f.get("file");
      if (!(file instanceof File) || !file.size) return { error: "Choose the bank position .xlsx file." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
      try {
        const picked = pickBankPositionSheet(sheetsFromWorkbook(await readWorkbook(Buffer.from(await file.arrayBuffer()))));
        if (!picked) throw new Error("No sheet with a dated 'BANK POSITION AS OF' heading was found. Copy that sheet (as values) into a new workbook and upload that.");
        const { asOf, rows, errors } = parseBankPosition(picked.sheet.grid);
        if (errors.length || !asOf) throw new Error(`${sanitizeUploadFileName(file.name)}: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` (and ${errors.length - 5} more)` : ""}`);
        const n = await saveBankPosition(asOf, rows);
        await addLog("Bank position uploaded", true, n);
        revalidatePath("/finance/banks"); revalidatePath("/admin/activity");
        return { ok: `Saved ${n} facility rows as of ${asOf}.` };
      } catch (e) {
        await addLog("Bank position rejected", false, 0);
        revalidatePath("/admin/activity");
        return { error: (e as Error).message };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}
