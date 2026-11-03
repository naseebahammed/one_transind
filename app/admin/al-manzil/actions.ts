"use server";
import ExcelJS from "exceljs";
import { readFileSync } from "fs";
import { revalidatePath } from "next/cache";
import { AL_MANZIL_KEY, DAILY_HEADER, MONTHS, PNL_HEADER, aggregateSales, dailyPath, mergeDaily, pnlPath, salesPath, setCell, withFileLock, writeCsv } from "@/lib/al-manzil";

export type UploadState = { error?: string; ok?: string };

const num = (v: ExcelJS.CellValue) => {
  const x = typeof v === "object" && v && "result" in v ? v.result : v; // formula cells carry their cached value
  return typeof x === "number" ? Math.round(x * 100) / 100 : 0;
};

/** Replace one year of the company's P&L CSV with the detail rows of a monthly P&L workbook (first sheet). */
export async function uploadPnl(_: UploadState, f: FormData): Promise<UploadState> {
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const file = f.get("file");
  if (!(file instanceof File)) return { error: "Choose an .xlsx monthly P&L file." };
  const year = Number(f.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: "Enter a valid year." };
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer); } catch { return { error: "Could not read that file as an Excel workbook." }; }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "That workbook has no sheet." };
  // Month columns are found by their header text (e.g. "Jul-25", "Aug-2025"), not by a fixed position -
  // a workbook can cover any subset of months, in any order.
  const colMonth = new Map<number, number>();
  for (let i = 1; i <= 2; i++) {
    ws.getRow(i).eachCell({ includeEmpty: false }, (cell, col) => {
      const m = String(cell.text ?? "").trim().match(/^([A-Za-z]{3})/);
      const mi = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) : -1;
      if (mi >= 0) colMonth.set(col, mi);
    });
  }
  if (!colMonth.size) return { error: "Could not find any month columns in the header (e.g. \"Jul-25\")." };
  const months = [...colMonth.keys()];
  const out: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i < 3) return;
    const text = (c: number) => String(row.getCell(c).text ?? "").trim();
    let main = text(1);
    const sub = text(4);
    if (!main || !sub || main.endsWith("Total")) return;
    if (main === "BANK CHARGES") main = "FINANCE COST";
    const vals = Array<number>(12).fill(0);
    for (const col of months) vals[colMonth.get(col)!] = num(row.getCell(col).value);
    out.push([year, main.replaceAll(",", " "), sub.replaceAll(",", " "), ...vals].join(","));
  });
  if (!out.length || !out.some((l) => l.startsWith(`${year},REVENUE,`))) return { error: "No account rows found - is this the monthly P&L layout?" };
  const path = pnlPath(key);
  const present = new Set(colMonth.values());
  await withFileLock(path, () => {
    let lines: string[];
    try { lines = readFileSync(path, "utf8").trim().split("\n"); } catch { lines = [PNL_HEADER]; } // first upload for this company
    // Only the uploaded months replace existing figures for that account; other months of the same year are kept as-is.
    const other = lines.slice(1).filter((l) => !l.startsWith(`${year},`));
    const existing = new Map(lines.slice(1).filter((l) => l.startsWith(`${year},`)).map((l) => [l.split(",").slice(0, 3).join(","), l.split(",")]));
    for (const row of out) {
      const cells = row.split(",");
      const key2 = cells.slice(0, 3).join(",");
      const merged = existing.get(key2) ?? cells;
      for (const mi of present) merged[3 + mi] = cells[3 + mi];
      existing.set(key2, merged);
    }
    writeCsv([lines[0], ...other, ...[...existing.values()].map((c) => c.join(","))].join("\n") + "\n", path);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
  return { ok: `Loaded ${out.length} accounts for ${year}.` };
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
    const ws = wb.worksheets[0];
    if (!ws) return { error: "That workbook has no sheet." };
    // Layout: "Date, Long Stay Guests, Avg Rate, Total, Short Stay Guests, Avg Rate, Total, Total Room Occupancy,
    // Daily Revenue, Total Revenue, Daily Avg Rate, Rms/Avl., OCC%" under a title row and a grouped LONG/SHORT STAY header row.
    const lines: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const dv = row.getCell(1).value;
      const date = dv instanceof Date ? dv.toISOString().slice(0, 10) : (() => { const d = new Date(String(dv ?? "").trim()); return isNaN(+d) ? null : d.toISOString().slice(0, 10); })();
      if (!date) return; // title / grouped-header / blank rows have no date
      const dailyRevenue = num(row.getCell(9).value), totalRevenue = num(row.getCell(10).value);
      const occRaw = num(row.getCell(13).value), occ = occRaw > 1 ? occRaw / 100 : occRaw;
      const vals = [2, 3, 4, 5, 6, 7, 8].map((c) => num(row.getCell(c).value)).concat([dailyRevenue, totalRevenue - dailyRevenue, num(row.getCell(11).value)]);
      lines.push([date, ...vals, num(row.getCell(12).value), occ].join(","));
    });
    if (!lines.length) return { error: "No dated rows found - is this the monthly sales report layout?" };
    text = [DAILY_HEADER, ...lines].join("\n") + "\n";
  } else {
    text = Buffer.from(buf).toString("utf8"); // not a readable workbook - treat it as a CSV
  }
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const path = dailyPath(key);
  let merged: string;
  try {
    merged = await withFileLock(path, () => {
      let existing = "";
      try { existing = readFileSync(path, "utf8"); } catch { /* first upload for this company */ }
      const out = mergeDaily(existing, text);
      writeCsv(out, path);
      return out;
    });
  } catch (e) { return { error: (e as Error).message }; }
  // Re-aggregate the monthly sales grid for every year touched by this upload, from the full merged daily history.
  const salesCsvPath = salesPath(key);
  const touchedYears = [...new Set(text.trim().split("\n").slice(1).map((l) => +l.slice(0, 4)))];
  await withFileLock(salesCsvPath, () => {
    let lines: string[];
    try { lines = readFileSync(salesCsvPath, "utf8").trim().split("\n"); } catch { lines = [PNL_HEADER]; }
    const kept = lines.slice(1).filter((l) => !touchedYears.includes(+l.split(",")[0]));
    const fresh = touchedYears.flatMap((y) => aggregateSales(merged, y));
    writeCsv([lines[0], ...kept, ...fresh].join("\n") + "\n", salesCsvPath);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate");
  return { ok: `Loaded ${text.trim().split("\n").length - 1} daily rows.` };
}

/** One upload form for every report type: "pnl" (monthly P&L workbook) or "daily" (daily sales report). */
export async function uploadReport(s: UploadState, f: FormData): Promise<UploadState> {
  return f.get("type") === "daily" ? uploadDaily(f) : uploadPnl(s, f);
}

/** Save one edited figure: year + key bind first so the client component gets a plain (main, sub, month, value) action. */
export async function savePnlCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  const path = pnlPath(key);
  await withFileLock(path, () => writeCsv(setCell(readFileSync(path, "utf8"), year, main, sub, month, value), path));
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
}

/** Save one edited monthly sales figure: same shape and flow as savePnlCell, but in the sales grid's own file. */
export async function saveSalesCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  const path = salesPath(key);
  await withFileLock(path, () => writeCsv(setCell(readFileSync(path, "utf8"), year, main, sub, month, value), path));
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
}

/** Delete one year's P&L statement for a company. */
export async function deletePnlYear(f: FormData) {
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const year = String(f.get("year"));
  const path = pnlPath(key);
  await withFileLock(path, () => {
    let lines: string[];
    try { lines = readFileSync(path, "utf8").trim().split("\n"); } catch { return; }
    writeCsv([lines[0], ...lines.slice(1).filter((l) => !l.startsWith(`${year},`))].join("\n") + "\n", path);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate"); revalidatePath("/finance");
}

/** Delete one year of a company's monthly sales report: the daily rows and the matching monthly sales grid. */
export async function deleteDailyYear(f: FormData) {
  const key = String(f.get("key") ?? AL_MANZIL_KEY);
  const year = String(f.get("year"));
  const path = dailyPath(key);
  await withFileLock(path, () => {
    let lines: string[];
    try { lines = readFileSync(path, "utf8").trim().split("\n"); } catch { return; }
    writeCsv([lines[0], ...lines.slice(1).filter((l) => !l.startsWith(`${year}-`))].join("\n") + "\n", path);
  });
  const salesCsvPath = salesPath(key);
  await withFileLock(salesCsvPath, () => {
    let lines: string[];
    try { lines = readFileSync(salesCsvPath, "utf8").trim().split("\n"); } catch { return; }
    writeCsv([lines[0], ...lines.slice(1).filter((l) => !l.startsWith(`${year},`))].join("\n") + "\n", salesCsvPath);
  });
  revalidatePath("/admin", "layout"); revalidatePath("/admin/finance"); revalidatePath("/real-estate");
}
