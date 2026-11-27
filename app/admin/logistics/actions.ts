"use server";
import { revalidatePath } from "next/cache";
import { readWorkbook, sheetsFromWorkbook, MAX_UPLOAD_BYTES } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { parseProfitability, PROFITABILITY_LINES } from "@/lib/profitability";
import { saveProfitability } from "@/lib/profitability-records";
import { sanitizeUploadFileName } from "@/lib/upload-security";

export type ProfitabilityUploadState = { error?: string; ok?: string };

/** Reads one profitability workbook (one sheet per month) for the year and business line chosen in the form. Any bad sheet refuses the file; months already on file are replaced. */
export async function uploadProfitability(_: ProfitabilityUploadState, f: FormData): Promise<ProfitabilityUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  try {
    return await withUploadSlot(admin.email, async () => {
      const file = f.get("file"), line = String(f.get("line") ?? ""), year = Number(f.get("year"));
      if (!(PROFITABILITY_LINES as readonly string[]).includes(line)) return { error: "Choose the business line." };
      if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 1) return { error: "Enter a valid year." };
      if (!(file instanceof File) || !file.size) return { error: "Choose the profitability .xlsx file." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
      try {
        const { rows, errors } = parseProfitability(sheetsFromWorkbook(await readWorkbook(Buffer.from(await file.arrayBuffer()))), line);
        if (errors.length) throw new Error(`${sanitizeUploadFileName(file.name)}: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` (and ${errors.length - 5} more)` : ""}`);
        const n = await saveProfitability(year, rows);
        await addLog("Logistics profitability uploaded", true, n);
        revalidatePath("/logistics/profitability"); revalidatePath("/admin/activity");
        return { ok: `Saved ${n} months for ${year}.` };
      } catch (e) {
        await addLog("Logistics profitability rejected", false, 0);
        revalidatePath("/admin/activity");
        return { error: (e as Error).message };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}
