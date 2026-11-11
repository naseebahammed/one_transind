"use server";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { cleanText, parsePositiveIntId } from "@/lib/input-validation";
import { inspectWorkbookArchive, sanitizeUploadFileName } from "@/lib/upload-security";
import { revalidatePath, updateTag } from "next/cache";
import { branchOf } from "@/lib/branches";
import { getCompany } from "@/lib/companies";
import { checkFigureCell, isFigureSection, LINES, MONTHS, parseGrid, SECTIONS, type FigureSection } from "@/lib/company-data";
import { deleteFigureMonth, importFigures, linesOf, recordRejected, setFigure, type Upload } from "@/lib/company-figures";
import { gridFromWorkbook, MAX_UPLOAD_BYTES, readWorkbook } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { REPORTS_CACHE_TAG } from "@/lib/reports";

export type FigureUploadState = { error?: string; ok?: string };

const sectionName = (s: string) => SECTIONS.find(([k]) => k === s)?.[1] ?? s;

function refreshFigurePaths(companyId: number) {
  updateTag(REPORTS_CACHE_TAG);
  for (const p of [`/admin/companies/${companyId}`, "/admin/companies", "/admin/finance", "/admin/data-status", "/admin/activity"]) revalidatePath(p);
}

const validYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2100;

/** Validates a section's filled template, then saves it. Any problem saves nothing except the record of the attempt. */
export async function uploadFigures(_: FigureUploadState, f: FormData): Promise<FigureUploadState> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }

  try {
    return await withUploadSlot(admin.email, async () => {
      const section = cleanText(f.get("section"), 30), year = Number(f.get("year")), companyId = parsePositiveIntId(f.get("companyId")), file = f.get("file");
      if (!isFigureSection(section) || !validYear(year)) return { error: "Unknown section or year." };
      if (!companyId) return { error: "Company not found." };
      const company = await getCompany(companyId);
      if (!company) return { error: "Company not found." };
      const branchId = await branchOf(company.id, f.get("branchId"));
      if (branchId === undefined) return { error: "Branch not found." };
      if (!(file instanceof File) || !file.size) return { error: "Choose the filled .xlsx or .csv template." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
      const buf = Buffer.from(await file.arrayBuffer());
      const archiveCheck = inspectWorkbookArchive(buf);
      if (!archiveCheck.ok) return { error: archiveCheck.error };
      const safeName = sanitizeUploadFileName(file.name);
      const u: Upload = { companyId: company.id, section, name: safeName, type: archiveCheck.mimeType, buf, branchId, uploadedBy: admin.email };
      try {
        const parsed = parseGrid(section, gridFromWorkbook(await readWorkbook(u.buf)), { company: company.name, year }, new Date());
        if ("error" in parsed) throw new Error(parsed.error);
        const groups = await linesOf(section);
        await importFigures(u, parsed.figures.map((x) => ({ ...x, main: groups.get(x.line)! })));
        const months = new Set(parsed.figures.map((x) => x.month));
        await addLog(`${company.name}: ${sectionName(section)} ${year} uploaded`, true, months.size);
        refreshFigurePaths(company.id);
        return { ok: `Saved ${months.size} month${months.size > 1 ? "s" : ""}: ${[...months].map((m) => MONTHS[m]).join(", ")}.` };
      } catch (e) {
        const error = (e as Error).message;
        await recordRejected(u, error);
        await addLog(`${company.name}: ${sectionName(section)} ${year} rejected`, false, 0);
        revalidatePath("/admin/activity");
        return { error };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}

/** One figure typed by hand instead of uploaded: year + companyId bind first so the client editor gets a plain (main, sub, month, value) action. */
export async function saveFigureCell(section: FigureSection, year: number, companyId: number, branchId: number | null, _main: string, sub: string, month: number, value: number) {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return e.message;
    throw e;
  }
  const safeCompanyId = parsePositiveIntId(companyId);
  const safeSub = cleanText(sub, 80);
  if (!isFigureSection(section) || !validYear(year) || !safeCompanyId || !LINES[section].includes(safeSub)) return "Invalid figure parameters.";
  const cellProblem = checkFigureCell(safeSub, value);
  if (cellProblem) return cellProblem;
  if (!Number.isInteger(month) || month < 0 || month > 11) return "Invalid month.";
  const company = await getCompany(safeCompanyId);
  const verifiedBranchId = company ? await branchOf(company.id, branchId) : undefined;
  if (!company || verifiedBranchId === undefined) return "Company or branch not found.";
  const main = (await linesOf(section)).get(safeSub);
  if (!main) return "Unknown line.";
  const refused = await setFigure(company.id, section, year, month, main, safeSub, "", value, verifiedBranchId);
  if (refused) return refused;
  await addLog(`${company.name}: ${sectionName(section)} ${safeSub} ${MONTHS[month]} ${year} set to ${value}`);
  refreshFigurePaths(company.id);
}

export async function removeFigureMonth(f: FormData) {
  await requireAdmin("mutation");
  const section = cleanText(f.get("section"), 30), year = Number(f.get("year")), month = Number(f.get("month")), companyId = parsePositiveIntId(f.get("companyId"));
  if (!isFigureSection(section) || !validYear(year) || !Number.isInteger(month) || month < 0 || month > 11 || !companyId) return;
  const company = await getCompany(companyId);
  if (!company) return;
  const branchId = await branchOf(company.id, f.get("branchId"));
  if (branchId === undefined) return;
  await deleteFigureMonth(company.id, section, year, month, branchId);
  await addLog(`${company.name}: ${sectionName(section)} ${MONTHS[month]} ${year} removed`);
  refreshFigurePaths(company.id);
}
