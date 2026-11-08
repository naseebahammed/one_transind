"use server";
import { revalidatePath } from "next/cache";
import { branchOf } from "@/lib/branches";
import { getCompany } from "@/lib/companies";
import { checkFigureCell, isFigureSection, LINES, MONTHS, parseGrid, SECTIONS, type FigureSection } from "@/lib/company-data";
import { deleteFigureMonth, importFigures, linesOf, recordRejected, setFigure, type Upload } from "@/lib/company-figures";
import { gridFromWorkbook, MAX_UPLOAD_BYTES, readWorkbook } from "@/lib/company-template";
import { addLog } from "@/lib/db";

export type FigureUploadState = { error?: string; ok?: string };

const sectionName = (s: string) => SECTIONS.find(([k]) => k === s)?.[1] ?? s;

function refreshFigurePaths(companyId: number) {
  for (const p of [`/admin/companies/${companyId}`, "/admin/companies", "/admin/finance", "/admin/data-status", "/admin/activity"]) revalidatePath(p);
}

/** Validates a section's filled template, then saves it. Any problem saves nothing except the record of the attempt. */
export async function uploadFigures(_: FigureUploadState, f: FormData): Promise<FigureUploadState> {
  const section = String(f.get("section")), year = Number(f.get("year")), file = f.get("file");
  if (!isFigureSection(section) || !Number.isInteger(year)) return { error: "Unknown section or year." };
  const company = await getCompany(Number(f.get("companyId")));
  if (!company) return { error: "Company not found." };
  const branchId = await branchOf(company.id, f.get("branchId"));
  if (branchId === undefined) return { error: "Branch not found." };
  if (!(file instanceof File) || !file.size) return { error: "Choose the filled .xlsx or .csv template." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 5 MB." };
  const u: Upload = { companyId: company.id, section, name: file.name, type: file.type, buf: Buffer.from(await file.arrayBuffer()), branchId };
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
}

/** One figure typed by hand instead of uploaded: year + companyId bind first so the client editor gets a plain (main, sub, month, value) action. */
export async function saveFigureCell(section: FigureSection, year: number, companyId: number, branchId: number | null, main: string, sub: string, month: number, value: number) {
  if (!isFigureSection(section) || !LINES[section].includes(sub) || checkFigureCell(sub, value)) return;
  const company = await getCompany(companyId);
  if (!company || (await branchOf(company.id, branchId)) === undefined) return;
  await setFigure(company.id, section, year, month, main, sub, "", value, branchId);
  await addLog(`${company.name}: ${sectionName(section)} ${sub} ${MONTHS[month]} ${year} set to ${value}`);
  refreshFigurePaths(company.id);
}

export async function removeFigureMonth(f: FormData) {
  const section = String(f.get("section")), year = Number(f.get("year")), month = Number(f.get("month"));
  if (!isFigureSection(section) || !Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) return;
  const company = await getCompany(Number(f.get("companyId")));
  if (!company) return;
  const branchId = await branchOf(company.id, f.get("branchId"));
  if (branchId === undefined) return;
  await deleteFigureMonth(company.id, section, year, month, branchId);
  await addLog(`${company.name}: ${sectionName(section)} ${MONTHS[month]} ${year} removed`);
  refreshFigurePaths(company.id);
}
