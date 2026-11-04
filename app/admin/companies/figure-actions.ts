"use server";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { getCompany } from "@/lib/companies";
import { isFigureSection, MONTHS, parseGrid, SECTIONS } from "@/lib/company-data";
import { deleteFigureMonth, saveFigures } from "@/lib/company-figures";
import { gridFromWorkbook } from "@/lib/company-template";
import { addLog } from "@/lib/db";

export type FigureUploadState = { error?: string; ok?: string };

const MAX_BYTES = 5 * 1024 * 1024;
const sectionName = (s: string) => SECTIONS.find(([k]) => k === s)?.[1] ?? s;

/** Validates a section's filled template, then saves it. Any problem saves nothing. */
export async function uploadFigures(_: FigureUploadState, f: FormData): Promise<FigureUploadState> {
  const section = String(f.get("section")), year = Number(f.get("year")), file = f.get("file");
  if (!isFigureSection(section) || !Number.isInteger(year)) return { error: "Unknown section or year." };
  const company = await getCompany(Number(f.get("companyId")));
  if (!company) return { error: "Company not found." };
  if (!(file instanceof File) || !file.size) return { error: "Choose the filled .xlsx template." };
  if (file.size > MAX_BYTES) return { error: "The file must be under 5 MB." };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer); } catch { return { error: "Could not read that file as an Excel workbook." }; }
  const parsed = parseGrid(section, gridFromWorkbook(wb), { company: company.name, year }, new Date());
  if ("error" in parsed) return parsed;
  await saveFigures(company.id, section, parsed.figures);
  const months = new Set(parsed.figures.map((x) => x.month));
  await addLog(`${company.name}: ${sectionName(section)} ${year} uploaded`, true, months.size);
  revalidatePath(`/admin/companies/${company.id}`);
  return { ok: `Saved ${months.size} month${months.size > 1 ? "s" : ""}: ${[...months].map((m) => MONTHS[m]).join(", ")}.` };
}

export async function removeFigureMonth(f: FormData) {
  const section = String(f.get("section")), year = Number(f.get("year")), month = Number(f.get("month"));
  if (!isFigureSection(section) || !Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) return;
  const company = await getCompany(Number(f.get("companyId")));
  if (!company) return;
  await deleteFigureMonth(company.id, section, year, month);
  await addLog(`${company.name}: ${sectionName(section)} ${MONTHS[month]} ${year} removed`);
  revalidatePath(`/admin/companies/${company.id}`);
}
