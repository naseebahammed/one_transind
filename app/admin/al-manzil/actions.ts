"use server";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { getCompany } from "@/lib/companies";
import { parseGrid, sectionName } from "@/lib/company-data";
import { gridFromWorkbook } from "@/lib/company-template";
import { AL_MANZIL_KEY, DAILY_HEADER, MONTHS, PNL_HEADER, aggregateSales, dailyFromWorkbook, dailyPath, keyFor, mergeSales, num, mergeDaily, pnlPath, salesPath, setCell, unitsFromWorkbook, unitsPath, withFileLock, writeCsv, readFile, needFile } from "@/lib/al-manzil";

export type UploadState = { error?: string; ok?: string };

/** Replace one year of the company's P&L CSV with the detail rows of a monthly P&L workbook (first sheet). */
export async function uploadPnl(_: UploadState, f: FormData): Promise<UploadState> {
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const file = f.get("file");
  if (!(file instanceof File)) return { error: "Choose an .xlsx monthly P&L file." };
  const formYear = Number(f.get("year")); // fallback for headers without a year, e.g. "Jul"
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer); } catch { return { error: "Could not read that file as an Excel workbook." }; }
  // The workbook can carry hidden prior-year sheets first, so use the first visible sheet that has month columns.
  const colMonth = new Map<number, number>();
  const colYear = new Map<number, number>();
  const ws = wb.worksheets.find((w) => {
    if (w.state !== "visible") return false;
    colMonth.clear(); colYear.clear();
    // Month columns are found by header text (e.g. "Jul-25", "Aug-2025"), not by a fixed position.
    for (let i = 1; i <= 2; i++) {
      w.getRow(i).eachCell({ includeEmpty: false }, (cell, col) => {
        const m = String(cell.text ?? "").trim().match(/^([A-Za-z]{3})/);
        const mi = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) : -1;
        if (mi < 0) return;
        const t = String(cell.text).trim(), y4 = t.match(/(\d{4})\s*$/), y2 = t.match(/-(\d{2})\s*$/);
        colMonth.set(col, mi);
        colYear.set(col, y4 ? +y4[1] : y2 ? 2000 + +y2[1] : formYear); // "Jun-Jul-2025" (two months in one column) lands in Jun
      });
    }
    return colMonth.size > 0 && [...colYear.values()].every((y) => y >= 2000 && y <= 2100);
  });
  if (!ws) return { error: "Could not find month columns with a year in the header (e.g. \"Jul-25\") - or enter the year." };
  const years = [...new Set(colYear.values())];
  const out: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i < 3) return;
    const text = (c: number) => String(row.getCell(c).text ?? "").trim();
    let main = text(1);
    const sub = text(4);
    if (!main || !sub || main.endsWith("Total")) return;
    if (main === "BANK CHARGES") main = "FINANCE COST";
    for (const year of years) {
      const vals = Array<number>(12).fill(0);
      for (const [col, mi] of colMonth) if (colYear.get(col) === year) vals[mi] = num(row.getCell(col).value);
      out.push([year, main.replaceAll(",", " "), sub.replaceAll(",", " "), ...vals].join(","));
    }
  });
  if (!out.some((l) => l.includes(",REVENUE,"))) return { error: "No account rows found - is this the monthly P&L layout?" };
  const path = pnlPath(key);
  await withFileLock(path, async () => {
    const lines = (await readFile(path))?.trim().split("\n") ?? [PNL_HEADER]; // first upload for this company
    // Only the uploaded months replace existing figures for that account; other months of the same year are kept as-is.
    const existing = new Map(lines.slice(1).map((l) => [l.split(",").slice(0, 3).join(","), l.split(",")]));
    for (const row of out) {
      const cells = row.split(",");
      const year = +cells[0];
      const key2 = cells.slice(0, 3).join(",");
      const merged = existing.get(key2) ?? cells;
      for (const [col, mi] of colMonth) if (colYear.get(col) === year) merged[3 + mi] = cells[3 + mi];
      existing.set(key2, merged);
    }
    await writeCsv([lines[0], ...[...existing.values()].map((c) => c.join(","))].join("\n") + "\n", path);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
  return { ok: `Loaded ${out.length / years.length} accounts for ${years.join(", ")}.` };
}

/** Merge a daily sales report (same columns as the daily CSV, as .csv or .xlsx - detected from content, not the file name) into the company's daily file; days in the upload replace existing days. */
async function uploadDaily(f: FormData): Promise<UploadState> {
  const file = f.get("file");
  if (!(file instanceof File)) return { error: "Choose a .csv or .xlsx daily sales report." };
  const buf = await file.arrayBuffer();
  let text: string;
  const wb = new ExcelJS.Workbook();
  const isXlsx = await wb.xlsx.load(buf as ExcelJS.Buffer).then(() => true, () => false);
  if (isXlsx) {
    const lines = dailyFromWorkbook(wb);
    if (!lines.length) return { error: "No dated rows found - is this the monthly sales report layout?" };
    text = [DAILY_HEADER, ...lines].join("\n") + "\n";
  } else {
    text = Buffer.from(buf).toString("utf8"); // not a readable workbook - treat it as a CSV
  }
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const path = dailyPath(key);
  let merged: string;
  try {
    merged = await withFileLock(path, async () => {
      const existing = (await readFile(path)) ?? "";
      const out = mergeDaily(existing, text);
      await writeCsv(out, path);
      return out;
    });
  } catch (e) { return { error: (e as Error).message }; }
  // Re-aggregate the monthly sales grid for every year touched by this upload, from the full merged daily history.
  const salesCsvPath = salesPath(key);
  const touchedYears = [...new Set(text.trim().split("\n").slice(1).map((l) => +l.slice(0, 4)))];
  await withFileLock(salesCsvPath, async () => {
    const lines = (await readFile(salesCsvPath))?.trim().split("\n") ?? [PNL_HEADER];
    const kept = lines.slice(1).filter((l) => !touchedYears.includes(+l.split(",")[0]));
    const fresh = touchedYears.flatMap((y) => aggregateSales(merged, y));
    await writeCsv([lines[0], ...kept, ...fresh].join("\n") + "\n", salesCsvPath);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate");
  return { ok: `Loaded ${text.trim().split("\n").length - 1} daily rows.` };
}

/** Merge a unit-type (1 BHK / 2 BHK ...) sales workbook into the company's units file; months present in the upload replace the same months on file. */
async function uploadUnits(f: FormData): Promise<UploadState> {
  const file = f.get("file");
  if (!(file instanceof File)) return { error: "Choose an .xlsx unit-type sales report." };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer); } catch { return { error: "Could not read that file as an Excel workbook." }; }
  const { lines, months } = unitsFromWorkbook(wb);
  if (!lines.length) return { error: "No unit-type rows found - is this the 1 BHK / 2 BHK sales report layout?" };
  const path = unitsPath(String(f.get("key") ?? AL_MANZIL_KEY));
  await withFileLock(path, async () => {
    const old = (await readFile(path))?.trim().split("\n") ?? [PNL_HEADER]; // first upload for this company
    const rows = new Map(old.slice(1).map((l) => [l.split(",").slice(0, 3).join(","), l.split(",")]));
    for (const l of lines) {
      const cells = l.split(","), k = cells.slice(0, 3).join(",");
      const merged = rows.get(k) ?? cells.slice(0, 3).concat(Array<string>(12).fill("0"));
      for (let mi = 0; mi < 12; mi++) if (months.has(`${cells[0]}-${mi}`)) merged[3 + mi] = cells[3 + mi];
      rows.set(k, merged);
    }
    await writeCsv([PNL_HEADER, ...[...rows.values()].map((c) => c.join(","))].join("\n") + "\n", path);
  });
  revalidatePath("/admin/finance");
  return { ok: `Loaded ${lines.length} unit-type rows.` };
}

/** Monthly sales template for companies with no stay report (Pavati, Top Perfume): months in the file replace the same months in the sales grid. */
async function uploadSales(f: FormData): Promise<UploadState> {
  const file = f.get("file");
  const company = await getCompany(Number(f.get("companyId")));
  if (!company) return { error: "Company not found." };
  if (company.sector === "re") return { error: "Real estate sales come from the daily report." }; // a hotel's grid already has revenue lines, so a Sales line would double count
  if (!(file instanceof File) || !file.size) return { error: "Choose the filled .xlsx template." };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer); } catch { return { error: "Could not read that file as an Excel workbook." }; }
  const grid = gridFromWorkbook(wb);
  const year = Number(String(grid[0]?.[0] ?? "").match(/(\d{4})\s*$/)?.[1]);
  if (!year) return { error: `This file is not a ${sectionName("sales")} template. Download one and try again.` };
  const parsed = parseGrid("sales", grid, { company: company.name, year }, new Date());
  if ("error" in parsed) return parsed;
  const path = salesPath(keyFor(company));
  await withFileLock(path, async () => {
    const existing = (await readFile(path)) ?? "";
    await writeCsv(mergeSales(existing, parsed.figures), path);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/dashboard"); revalidatePath("/health-beauty"); revalidatePath("/retail");
  return { ok: `Saved ${parsed.figures.length} month${parsed.figures.length > 1 ? "s" : ""} for ${year}: ${parsed.figures.map((x) => MONTHS[x.month]).join(", ")}.` };
}

/** One upload form for every report type: "pnl" (monthly P&L workbook), "daily" (daily sales report), "units" (per unit-type sales) or "sales" (monthly sales template). */
export async function uploadReport(s: UploadState, f: FormData): Promise<UploadState> {
  const t = f.get("type");
  return t === "daily" ? uploadDaily(f) : t === "units" ? uploadUnits(f) : t === "sales" ? uploadSales(f) : uploadPnl(s, f);
}

/** Save one edited unit-type figure: same shape and flow as saveSalesCell, in the units file. */
export async function saveUnitsCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  const path = unitsPath(key);
  await withFileLock(path, async () => writeCsv(setCell(await needFile(path), year, main, sub, month, value), path));
  revalidatePath("/admin/finance");
}

/** Save one edited figure: year + key bind first so the client component gets a plain (main, sub, month, value) action. */
export async function savePnlCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  const path = pnlPath(key);
  await withFileLock(path, async () => writeCsv(setCell(await needFile(path), year, main, sub, month, value), path));
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
}

/** Save one edited monthly sales figure: same shape and flow as savePnlCell, but in the sales grid's own file. */
export async function saveSalesCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  const path = salesPath(key);
  await withFileLock(path, async () => writeCsv(setCell(await needFile(path), year, main, sub, month, value), path));
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
}

/** Delete one year's P&L statement for a company. */
export async function deletePnlYear(f: FormData) {
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const year = String(f.get("year"));
  const path = pnlPath(key);
  await withFileLock(path, async () => {
    const linesText = await readFile(path);
    if (linesText == null) return;
    const lines = linesText.trim().split("\n");
    await writeCsv([lines[0], ...lines.slice(1).filter((l) => !l.startsWith(`${year},`))].join("\n") + "\n", path);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
}

/** Delete one year of a company's monthly sales report: the daily rows and the matching monthly sales grid. */
export async function deleteDailyYear(f: FormData) {
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const year = String(f.get("year"));
  const path = dailyPath(key);
  await withFileLock(path, async () => {
    const linesText = await readFile(path);
    if (linesText == null) return;
    const lines = linesText.trim().split("\n");
    await writeCsv([lines[0], ...lines.slice(1).filter((l) => !l.startsWith(`${year}-`))].join("\n") + "\n", path);
  });
  const salesCsvPath = salesPath(key);
  await withFileLock(salesCsvPath, async () => {
    const linesText = await readFile(salesCsvPath);
    if (linesText == null) return;
    const lines = linesText.trim().split("\n");
    await writeCsv([lines[0], ...lines.slice(1).filter((l) => !l.startsWith(`${year},`))].join("\n") + "\n", salesCsvPath);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate");
}
