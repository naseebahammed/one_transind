"use server";
import { revalidatePath } from "next/cache";
import { readWorkbook, sheetsFromWorkbook, MAX_UPLOAD_BYTES } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { parseBrandMonthPlan, parseBrandYearPlan } from "@/lib/brand-budget";
import { saveBrandMonthPlan, saveBrandYearPlan } from "@/lib/brand-budget-records";
import { sanitizeUploadFileName } from "@/lib/upload-security";

export type BrandBudgetUploadState = { error?: string; ok?: string };

/** Reads one budget workbook: the yearly brand plan (its "Brand Index" sheet) or the monthly plan (the sheet named after the year). A bad row refuses the file; the year's plan is replaced. */
export async function uploadBrandBudget(_: BrandBudgetUploadState, f: FormData): Promise<BrandBudgetUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  try {
    return await withUploadSlot(admin.email, async () => {
      const file = f.get("file"), kind = String(f.get("kind") ?? ""), year = Number(f.get("year"));
      if (kind !== "year" && kind !== "month") return { error: "Choose which plan the file holds." };
      if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 5) return { error: "Enter a valid year." };
      if (!(file instanceof File) || !file.size) return { error: "Choose the budget .xlsx file." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
      try {
        const sheets = sheetsFromWorkbook(await readWorkbook(Buffer.from(await file.arrayBuffer())));
        const sheet = kind === "year" ? sheets.find((s) => /brand index$/i.test(s.name.trim())) : sheets.find((s) => s.name.trim() === String(year));
        if (!sheet) throw new Error(kind === "year" ? 'No sheet ending in "Brand Index" found.' : `No sheet named "${year}" found.`);
        const { rows, errors } = kind === "year" ? parseBrandYearPlan(sheet.grid, year) : parseBrandMonthPlan(sheet.grid);
        if (errors.length) throw new Error(`${sanitizeUploadFileName(file.name)}: ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` (and ${errors.length - 5} more)` : ""}`);
        const n = kind === "year" ? await saveBrandYearPlan(year, rows as Parameters<typeof saveBrandYearPlan>[1]) : await saveBrandMonthPlan(year, rows as Parameters<typeof saveBrandMonthPlan>[1]);
        await addLog("Brand budget uploaded", true, n);
        revalidatePath("/sales/budget"); revalidatePath("/admin/activity");
        return { ok: `Saved ${n} ${kind === "year" ? "brand rows" : "monthly rows"} for ${year}.` };
      } catch (e) {
        await addLog("Brand budget rejected", false, 0);
        revalidatePath("/admin/activity");
        return { error: (e as Error).message };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}
