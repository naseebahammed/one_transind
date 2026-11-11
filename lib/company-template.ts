// Excel side of the company page's sections: builds the templates to send out and reads uploaded ones into a grid for parseGrid.
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { LINES, MONTHS, templateTitle, type Cell, type GridSection } from "./company-data.ts";
import { inspectWorkbookArchive } from "./upload-security.ts";

export function buildFigureTemplate(company: string, section: GridSection, year: number) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Data");
  ws.addRow([templateTitle(company, section, year)]).font = { bold: true };
  ws.addRow(["Line", ...MONTHS]).font = { bold: true };
  for (const line of LINES[section]) ws.addRow([line]);
  ws.getColumn(1).width = 34;
  return wb;
}

/** Same layout uploadPnl reads. One month only: uploadPnl stores a blank as 0 for every month column in the file, so a 12-month template would wipe the other months. */
export function buildPnlTemplate(year: number, month: number, accounts: { main: string; sub: string }[]) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("P&L");
  ws.getCell("A1").value = "Main account";
  ws.getCell("D1").value = "Account";
  ws.getCell("E1").value = `${MONTHS[month]}-${year}`;
  ws.getRow(1).font = { bold: true };
  accounts.forEach((a, i) => { ws.getCell(i + 3, 1).value = a.main; ws.getCell(i + 3, 4).value = a.sub; });
  ws.getColumn(1).width = 30; ws.getColumn(4).width = 34;
  return wb;
}

export const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
export const MAX_WORKBOOK_ROWS = 50_000;
export const MAX_WORKBOOK_COLS = 200;

/** A workbook from .xlsx or .csv bytes, told apart by content rather than the file name. Throws a readable message. */
export async function readWorkbook(buf: Buffer) {
  const inspection = inspectWorkbookArchive(buf);
  if (!inspection.ok) throw new Error(inspection.error);

  const wb = new ExcelJS.Workbook();
  if (inspection.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    try { await wb.xlsx.load(buf as unknown as ExcelJS.Buffer); return wb; } catch { throw new Error("Could not read that file as an Excel workbook."); }
  }
  // Cells stay as text: the default parser turns dates into local-time values, which land a day early in Qatar. num() and cellDate() read the text.
  await wb.csv.read(Readable.from(buf.toString("utf8").replace(/^﻿/, "")), { map: (v: string) => (v === "" ? null : v) });
  return wb;
}

const daysOf = (year: number, month: number) => Array.from({ length: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() }, (_, d) => new Date(Date.UTC(year, month, d + 1)));

/** Same columns dailyFromWorkbook reads: guests, rate and total sit side by side. Dates are filled in, and days left blank are skipped on upload. */
export function buildDailyTemplate(year: number, month: number, rooms: number) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Daily sales");
  ws.addRow(["Date", "Long Stay Guests", "Long Rate", "Long Total", "Short Stay Guests", "Short Rate", "Short Total", "Total Room Occupancy", "Daily Revenue", "Other Revenue", "Daily Avg Rate", "Rms/Avl."]).font = { bold: true };
  for (const d of daysOf(year, month)) ws.addRow([d, ...Array<null>(10).fill(null), rooms || null]);
  ws.getColumn(1).numFmt = "yyyy-mm-dd"; ws.getColumn(1).width = 12;
  return wb;
}

/** Same layout unitsFromWorkbook reads: a group name over a unit type in every column, not merged, so each column names both. */
export function buildUnitsTemplate(year: number, month: number, roomTypes: string[]) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Unit types");
  const types = roomTypes.length ? [...new Set(roomTypes)] : ["1 BHK", "2 BHK"];
  const groups = ["Availability", "Long Stay", "Short Stay", "Room Revenue"];
  ws.addRow(["Date", ...groups.flatMap((g) => types.map(() => g))]).font = { bold: true };
  ws.addRow([null, ...groups.flatMap(() => types)]).font = { bold: true };
  for (const d of daysOf(year, month)) ws.addRow([d]);
  ws.getColumn(1).numFmt = "yyyy-mm-dd"; ws.getColumn(1).width = 12;
  return wb;
}

/** A cell's real value: formula cells give their result, blank gives null (never 0), and anything that is not a number or text becomes text for the validator to reject. */
function readCell(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object" && "result" in v) return readCell(v.result as ExcelJS.CellValue);
  if (typeof v === "object" && "formula" in v) return null; // a formula Excel never calculated has no value yet
  if (typeof v === "object" && "richText" in v) return v.richText.map((x) => x.text).join("");
  return v instanceof Date ? v.toISOString() : String(Object(v).error ?? v);
}

/** The first visible sheet as rows of cells, 0-indexed. */
export function gridFromWorkbook(wb: ExcelJS.Workbook): Cell[][] {
  const ws = wb.worksheets.find((w) => w.state === "visible");
  if (!ws) return [];
  if (ws.rowCount > MAX_WORKBOOK_ROWS || ws.columnCount > MAX_WORKBOOK_COLS) {
    throw new Error("Spreadsheet dimensions exceed the maximum allowed rows or columns.");
  }
  const colLimit = Math.min(MAX_WORKBOOK_COLS, Math.max(ws.columnCount, 13));
  const grid: Cell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: Cell[] = [];
    for (let c = 1; c <= colLimit; c++) row.push(readCell(ws.getCell(r, c).value));
    grid.push(row);
  }
  return grid;
}
