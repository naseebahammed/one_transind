// Reads uploaded company report workbooks (P&L, daily stay report, unit-type report) into rows. Amounts in QAR: revenue positive, costs negative.
// Pure (no database) so `node --test` can load it.
import type ExcelJS from "exceljs";

import { MONTHS } from "./format.ts";
import { isValidFigureAmount } from "./input-validation.ts";
import { parseMoneyString, roundMoney, sumMoney } from "./money.ts";

export const BANK_DEPOSITS_LINE = "Bank deposits";
export const isBankDepositLine = (line: string) => /^bank\s+deposits?$/i.test(line.replace(/\s+/g, " ").trim());

const EXCEL_SERIAL_MIN = 18_264; // 1950-01-01
const EXCEL_SERIAL_MAX = 73_415; // 2100-12-31
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Formats an ExcelJS Date without shifting local-midnight values (such as UTC+03:00 Qatar) back into the previous calendar day. */
export function formatDateCell(d: Date): string {
  if (isNaN(+d)) return "";
  if (d.getUTCHours() !== 0 && d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
    return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return d.toISOString().slice(0, 10);
}

/** Converts an unformatted Excel 1900-system serial day number (1950..2100) to "YYYY-MM-DD", or null when outside calendar serial bounds. */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) return null;
  const wholeDays = Math.floor(serial + 1e-9);
  return new Date(EXCEL_EPOCH_MS + wholeDays * 86_400_000).toISOString().slice(0, 10);
}

/** Numeric value of a cell, or null when blank. Formula cells give their result; CSV text like "1,234" or "(50)" is read as a number. Anything else throws, so a bad cell is never loaded as 0. */
export function num(v: ExcelJS.CellValue, where: string): number | null {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  if (x === null || x === undefined) return null;
  if (typeof x === "number") {
    if (!isValidFigureAmount(x)) throw new Error(`${where}: "${x}" is not a valid amount.`);
    return roundMoney(x);
  }
  if (typeof x === "object" && ("formula" in x || "sharedFormula" in x)) return null; // a formula Excel never calculated has no value yet
  const raw = typeof x === "object" && "richText" in x ? (x as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("") : typeof x === "string" ? x : String((x as { error?: string }).error ?? x);
  const t = raw.trim();
  if (!t || t === "-") return null;
  const parsed = parseMoneyString(t);
  if (parsed === null || !isValidFigureAmount(parsed)) throw new Error(`${where}: "${t}" is not a number.`);
  return parsed;
}

/** "YYYY-MM-DD" from a date cell, Excel serial number, ISO text or dd/mm/yyyy text (what Excel writes to CSV here), or null for a cell that is not a date. */
export function cellDate(v: ExcelJS.CellValue, where: string) {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  if (x instanceof Date) {
    const formatted = formatDateCell(x);
    if (!formatted) throw new Error(`${where}: not a real date.`);
    return formatted;
  }
  if (typeof x === "number") return excelSerialToIsoDate(x);
  const t = String(x ?? "").trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/), dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!iso && !dmy) return null;
  if (dmy) {
    const first = Number(dmy[1]), second = Number(dmy[2]);
    if (first >= 1 && first <= 12 && second >= 13 && second <= 31) {
      throw new Error(`${where}: "${t}" uses MM/DD/YYYY (US date format). Save dates as DD/MM/YYYY or YYYY-MM-DD and upload again.`);
    }
  }
  const date = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : `${dmy![3]}-${dmy![2].padStart(2, "0")}-${dmy![1].padStart(2, "0")}`;
  const d = new Date(`${date}T00:00:00Z`);
  if (isNaN(+d) || d.toISOString().slice(0, 10) !== date) throw new Error(`${where}: "${t}" is not a real date.`);
  return date;
}

const isSlashDateCell = (v: ExcelJS.CellValue) => {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  return typeof x === "string" && /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(x.trim());
};

/** Detects ambiguous mid-month US MM/DD/YYYY CSV exports (e.g. 05/01/2026..05/11/2026), where DD/MM/YYYY lands on the same day across multiple months. */
function checkSlashDatesOnSheet(slashDates: string[], sheetName: string) {
  if (slashDates.length < 2) return;
  const uniqueDays = new Set(slashDates.map((d) => d.slice(8, 10)));
  const uniqueMonths = new Set(slashDates.map((d) => d.slice(0, 7)));
  if (uniqueDays.size === 1 && uniqueMonths.size >= 2) {
    throw new Error(`${sheetName}: dates look like MM/DD/YYYY (US date format) — every row landed on day ${slashDates[0].slice(8, 10)} of a different month. Save dates as DD/MM/YYYY or YYYY-MM-DD and upload again.`);
  }
}

/** "YYYY-MM" named by a sheet's title row ("... Report January-2026", "120 Al Sadd Residence Dec-2025"), or "" if none.
 *  A sheet whose date cells disagree with its title (copied sheet, dates never updated) is re-dated by row order. */
function sheetYm(ws: ExcelJS.Worksheet) {
  let ym = "";
  ws.getRow(1).eachCell((c) => {
    const tm = String(c.text).match(/([A-Za-z]{3})[a-z]*\s*-?\s*(\d{4})\s*$/), mi = tm ? MONTHS.findIndex((x) => x.toLowerCase() === tm[1].toLowerCase()) : -1;
    if (!ym && tm && mi >= 0) ym = `${tm[2]}-${String(mi + 1).padStart(2, "0")}`;
  });
  return ym;
}

type PnlLine = { year: number; month: number; main: string; line: string; value: number };

const MONTH_WORD = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const SINGLE_MONTH_HEADER_RE = new RegExp(`^(${MONTH_WORD})(?:[\\s/-]+(\\d{2}|\\d{4}))?$`, "i");
const COMBINED_MONTH_HEADER_RE = new RegExp(`^${MONTH_WORD}\\s*(?:[-/&]|to)\\s*${MONTH_WORD}(?:[\\s/-]+(?:\\d{2}|\\d{4}))?$`, "i");

const isFormulaCell = (v: ExcelJS.CellValue) => typeof v === "object" && v !== null && ("formula" in v || "sharedFormula" in v);

/** P&L figures from the first visible sheet with month columns (the workbook can carry hidden prior-year sheets first). Only months holding a non-zero figure are returned, so an empty or all-zero column leaves that month on file untouched. */
export function pnlFromWorkbook(wb: ExcelJS.Workbook, formYear: number): { error: string } | { rows: PnlLine[] } {
  const colMonth = new Map<number, number>(), colYear = new Map<number, number>();
  let headerError = "";
  const ws = wb.worksheets.find((w) => {
    if (w.state !== "visible") return false;
    colMonth.clear(); colYear.clear(); headerError = "";
    const seenPeriods = new Map<string, number>();
    // Month columns are found by header text (e.g. "Jul-25", "Aug-2025"), not by a fixed position.
    for (let i = 1; i <= 2; i++) {
      w.getRow(i).eachCell({ includeEmpty: false }, (cell, col) => {
        const t = String(cell.text ?? "").replace(/\s+/g, " ").trim();
        if (!t || /\b(?:total|ytd)\b/i.test(t)) return;
        if (COMBINED_MONTH_HEADER_RE.test(t)) {
          headerError ||= `Column "${t}" combines multiple months in one column. Split each month into its own column before uploading.`;
          return;
        }
        const single = t.match(SINGLE_MONTH_HEADER_RE);
        if (!single) return;
        const mi = MONTHS.findIndex((x) => x.toLowerCase() === single[1].slice(0, 3).toLowerCase());
        if (mi < 0) return;
        const rawYear = single[2];
        const year = rawYear ? (rawYear.length === 4 ? +rawYear : 2000 + +rawYear) : formYear;
        const periodKey = `${year}-${mi}`, priorCol = seenPeriods.get(periodKey);
        if (priorCol !== undefined && priorCol !== col) {
          headerError ||= `Duplicate column for ${MONTHS[mi]} ${year}. Remove or rename the duplicate column.`;
          return;
        }
        seenPeriods.set(periodKey, col);
        colMonth.set(col, mi);
        colYear.set(col, year);
      });
    }
    if (headerError && (colMonth.size > 0 || w.rowCount >= 3)) return true;
    return colMonth.size > 0 && [...colYear.values()].every((y) => y >= 2000 && y <= 2100);
  });
  if (headerError) return { error: headerError };
  if (!ws) return { error: "Could not find month columns with a year in the header (e.g. \"Jul-25\") - or enter the year." };
  const rows: PnlLine[] = [];
  let sawRevenue = false;
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i < 3) return;
    const text = (c: number) => String(row.getCell(c).text ?? "").replace(/\s+/g, " ").trim();
    let main = text(1);
    const line = text(4);
    if (!main || !line || main.endsWith("Total")) return;
    if (main === "BANK CHARGES") main = "FINANCE COST";
    if (main === "REVENUE") sawRevenue = true;
    for (const [col, month] of colMonth) {
      const value = num(row.getCell(col).value, `Row ${i}, ${MONTHS[month]}`);
      if (value !== null) rows.push({ year: colYear.get(col)!, month, main, line, value });
    }
  });
  if (!sawRevenue) return { error: "No account rows found - is this the monthly P&L layout?" };
  const filled = new Set(rows.filter((r) => r.value).map((r) => `${r.year}-${r.month}`));
  const kept = rows.filter((r) => filled.has(`${r.year}-${r.month}`));
  return kept.length ? { rows: kept } : { error: "The file has no figures." };
}

const fold = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Puts each line on its chart-of-accounts spelling and adds up lines that differ only by spacing or case. A line outside the chart with any non-zero figure rejects the file; one with only zeros is dropped. */
export function matchAccounts(rows: PnlLine[], chart: { main: string; sub: string }[]): { error: string } | { rows: PnlLine[] } {
  const known = new Map(chart.map((a) => [`${fold(a.main)}|${fold(a.sub)}`, a]));
  const out = new Map<string, PnlLine>(), unknown = new Set<string>();
  for (const r of rows) {
    const a = known.get(`${fold(r.main)}|${fold(r.line)}`);
    if (!a) { if (r.value) unknown.add(`${r.main} | ${r.line}`); continue; }
    const k = `${r.year}|${r.month}|${a.main}|${a.sub}`, cur = out.get(k);
    if (cur) cur.value = roundMoney(cur.value + r.value);
    else out.set(k, { ...r, main: a.main, line: a.sub });
  }
  if (unknown.size) return { error: `Not in the chart of accounts: ${[...unknown].slice(0, 5).join("; ")}${unknown.size > 5 ? ` and ${unknown.size - 5} more` : ""}. Fix the name, or add it under Chart of accounts first.` };
  return { rows: [...out.values()] };
}

export type DailyRow = { date: string; long_guests: number; long_rate: number; long_total: number; short_guests: number; short_rate: number; short_total: number; rooms_occupied: number; room_revenue: number; other_revenue: number; rooms_available: number };

/** Daily rows from every sheet of a sales workbook. Columns are found by header text, so the 2024/25 layout (blank spacer column, no "Other Revenue") and the 2026 one both load.
 *  Blank future rows (and trailing all-zero formula rows after the last active day) are skipped, while explicitly recorded 0-guest vacant days are kept so occupancy includes vacant availability. */
export function dailyFromWorkbook(wb: ExcelJS.Workbook) {
  const out: DailyRow[] = [];
  for (const ws of wb.worksheets) {
    const col = new Map<string, number>();
    let head = 0;
    for (let i = 1; i <= 5 && !head; i++) {
      ws.getRow(i).eachCell((c) => { if (String(c.value ?? "").trim().toLowerCase() === "date") head = i; });
    }
    if (!head) continue; // not a daily sheet
    ws.getRow(head).eachCell((c, n) => { const t = String(c.value ?? "").trim().toLowerCase(); if (t && !col.has(t)) col.set(t, n); });
    const at = (name: string) => col.get(name) ?? 0;
    const revCol = [...col].find(([t]) => t.includes("daily revenue"))?.[1] ?? 0;
    const c = { lg: at("long stay guests"), sg: at("short stay guests"), occ: at("total room occupancy"), rev: revCol, other: at("other revenue"), total: at("total revenue"), avl: at("rms/avl.") };
    if (!c.lg || !c.sg || !revCol) continue;
    const titleYm = sheetYm(ws), slashDates: string[] = [], sheetRows: { row: DailyRow; keepAnchor: boolean }[] = [];
    let remap: boolean | undefined, day = 0, prevTotal = 0, running: boolean | undefined; // running: "Total Revenue" is a month-to-date total (Al Manzil 2023-25), not a per-day figure
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= head) return;
      const where = `${ws.name}, row ${i}`, rawDateCell = row.getCell(1).value;
      let date = cellDate(rawDateCell, where); // date cells are often =previous+1 formulas
      if (!date) return; // title, sub total and blank rows have no date
      if (isSlashDateCell(rawDateCell)) slashDates.push(date);
      remap ??= !!titleYm && date.slice(0, 7) !== titleYm;
      if (remap) date = `${titleYm}-${String(++day).padStart(2, "0")}`;
      const rawAt = (k: number) => (k ? num(row.getCell(k).value, where) : null);
      const rawLg = rawAt(c.lg), rawSg = rawAt(c.sg), rawOcc = rawAt(c.occ), rawRev = rawAt(c.rev), rawOther = rawAt(c.other);
      if (rawLg === null && rawSg === null && rawOcc === null && rawRev === null && rawOther === null) return; // blank future day
      const n = (k: number) => rawAt(k) ?? 0;
      const longG = rawLg ?? 0, shortG = rawSg ?? 0;
      const longT = n(c.lg + 2), shortT = n(c.sg + 2);
      const occupied = (rawOcc ?? 0) || longG + shortG;
      const roomRev = (rawRev ?? 0) || longT + shortT;
      if (c.total && !c.other) { const t = n(c.total); if (prevTotal && roomRev) running ??= Math.abs(t - prevTotal - roomRev) < 1; if (roomRev || t) prevTotal = t; }
      const otherRev = c.other ? (rawOther ?? 0) : c.total && !running && (roomRev || n(c.total)) ? roundMoney(n(c.total) - roomRev) : 0; // 120 Al Sadd has Supermarket/Spa inside Total Revenue, no "other revenue" column
      const hasActivity = Boolean(longG || shortG || occupied || roomRev || otherRev);
      const hasExplicitZero = [c.lg, c.sg, c.occ, c.rev].some((colIdx) => {
        if (!colIdx) return false;
        const cv = row.getCell(colIdx).value;
        return cv !== null && cv !== undefined && !isFormulaCell(cv);
      });
      sheetRows.push({
        keepAnchor: hasActivity || hasExplicitZero,
        row: { date, long_guests: longG, long_rate: n(c.lg + 1), long_total: longT, short_guests: shortG, short_rate: n(c.sg + 1), short_total: shortT, rooms_occupied: occupied, room_revenue: roomRev, other_revenue: otherRev, rooms_available: n(c.avl) },
      });
    });
    checkSlashDatesOnSheet(slashDates, ws.name);
    const lastAnchor = sheetRows.findLastIndex((x) => x.keepAnchor);
    for (let idx = 0; idx <= lastAnchor; idx++) out.push(sheetRows[idx].row);
  }
  return out;
}

/** The first impossible day in an upload, or null. totalRooms 0 means the property's room count is not on file. */
export function checkDaily(rows: DailyRow[], totalRooms: number) {
  for (const r of rows) {
    if (r.rooms_available && r.rooms_occupied > r.rooms_available) return `${r.date}: ${r.rooms_occupied} rooms occupied but only ${r.rooms_available} available. Check the source report.`;
    if (totalRooms && r.rooms_available > totalRooms) return `${r.date}: ${r.rooms_available} rooms available, but the property has ${totalRooms}. Check the "Rms/Avl." column in the source report.`;
  }
  return null;
}

const UNIT_METRICS = [["availability", "Available"], ["long stay", "Long stay"], ["short stay", "Short stay"], ["revenue", "Room revenue"]] as const;
type UnitLine = { year: number; month: number; unit_type: string; line: string; value: number };

/** Monthly totals per unit type (e.g. "1 BHK") from a unit-type sales workbook.
 *  Layout: a group header row (Availability / Long Stay / Short Stay / ... Revenue) over a row naming the unit type in each column. */
export function unitsFromWorkbook(wb: ExcelJS.Workbook) {
  const acc = new Map<string, UnitLine>();
  for (const ws of wb.worksheets) {
    let g = 0;
    for (let i = 1; i <= 5 && !g; i++) ws.getRow(i).eachCell((c) => { if (String(c.text).trim().toLowerCase() === "availability") g = i; });
    if (!g) continue; // not a unit-type sheet
    const cols: { metric: string; type: string; col: number }[] = [];
    let dateCol = 0;
    ws.getRow(g).eachCell((c, n) => {
      const t = String(c.text).trim().toLowerCase(), m = UNIT_METRICS.find(([k]) => k === (t === "room revenue" ? "revenue" : t)); // Jul-2026 sheets say "Room Revenue"
      if (t === "date") dateCol = n;
      // "Other Revenue" is not a unit's own revenue, so only the exact group names count.
      if (m) cols.push({ metric: m[1], type: String(ws.getRow(g + 1).getCell(n).text).trim(), col: n });
    });
    if (!dateCol || !cols.length) continue;
    for (const x of cols) if (!x.type) throw new Error(`${ws.name}: the ${x.metric} column ${x.col} has no unit type above it.`);
    const titleYm = sheetYm(ws), slashDates: string[] = [];
    const sheetDays: { year: number; month: number; entries: [typeof cols[number], number][]; keepAnchor: boolean }[] = [];
    let remap: boolean | undefined, day = 0;
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= g + 1) return;
      const where = `${ws.name}, row ${i}`, rawDateCell = row.getCell(dateCol).value;
      let date = cellDate(rawDateCell, where);
      if (!date) return;
      if (isSlashDateCell(rawDateCell)) slashDates.push(date);
      remap ??= !!titleYm && date.slice(0, 7) !== titleYm;
      if (remap) date = `${titleYm}-${String(++day).padStart(2, "0")}`;
      const stayOrRevCols = cols.filter((x) => x.metric !== "Available");
      const stayOrRevVals = stayOrRevCols.map((x) => ({ col: x.col, val: num(row.getCell(x.col).value, where) }));
      if (stayOrRevVals.every((x) => x.val === null)) return; // blank future day
      const hasActivity = stayOrRevVals.some((x) => Boolean(x.val));
      const hasExplicitZero = stayOrRevVals.some((x) => {
        const cv = row.getCell(x.col).value;
        return cv !== null && cv !== undefined && !isFormulaCell(cv);
      });
      const year = +date.slice(0, 4), month = +date.slice(5, 7) - 1;
      sheetDays.push({
        year,
        month,
        keepAnchor: hasActivity || hasExplicitZero,
        entries: cols.map((x) => [x, num(row.getCell(x.col).value, where) ?? 0]),
      });
    });
    checkSlashDatesOnSheet(slashDates, ws.name);
    const lastAnchor = sheetDays.findLastIndex((x) => x.keepAnchor);
    for (let idx = 0; idx <= lastAnchor; idx++) {
      const d = sheetDays[idx];
      for (const [x, val] of d.entries) {
        const k = `${d.year},${d.month},${x.type},${x.metric}`;
        const a = acc.get(k) ?? acc.set(k, { year: d.year, month: d.month, unit_type: x.type, line: x.metric, value: 0 }).get(k)!;
        a.value = roundMoney(a.value + val);
      }
    }
  }
  return [...acc.values()];
}

export type ReceiptRow = { date: string; line: string; value: number };

/** A row the parser refused (loaded false), or kept but a person should check (loaded true). Saved to stg.rejected_rows with the import. */
export type ImportIssue = { sheet: string; row: number; reason: string; loaded: boolean };

/** The month a sheet's name gives ("March 2026", "April2026", "NOVEMBER "): year null if the name has none. Null when the name is not a month. */
function monthOfSheetName(name: string) {
  const mi = MONTHS.findIndex((m) => name.toLowerCase().startsWith(m.toLowerCase()));
  return mi < 0 ? null : { month: String(mi + 1).padStart(2, "0"), year: name.match(/20\d{2}/)?.[0] ?? null };
}

/** Daily takings from a branch's "Daily Sales Deposit" workbook: one sheet per month, one row per day, one column per payment channel.
 *  Columns are found by header text because the headings change between months. Gross sales and the totals rows are formulas, so they are recalculated, not read.
 *  In the newest sheet, days after the last day with a figure are the unfilled rest of the month (all zeros), so they are skipped; every other zero is a real zero.
 *  A sheet named for one month but dated in another is set aside and reported, so one bad sheet does not block the other months. fromYear leaves out older sheets. */
export function receiptsFromWorkbook(wb: ExcelJS.Workbook, fromYear = 0) {
  type Day = { date: string; values: [string, number][]; row: number; printed: number | null; unlabelled: [number, number][] };
  const rows: ReceiptRow[] = [], issues: ImportIssue[] = [], seen = new Map<string, string>(), sheets: { name: string; days: Day[]; last: number }[] = [];
  let title = "", rowsRead = 0, controlTotal = 0;
  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim(), named = monthOfSheetName(sheet);
    if (named?.year && +named.year < fromYear) continue;
    let head = 0, bank = 0, grossCol = 0, lastHeading = 0;
    for (let i = 1; i <= 6 && !head; i++) ws.getRow(i).eachCell((c, n) => { if (isBankDepositLine(String(c.value ?? ""))) { head = i; bank = n; } });
    if (!head) continue; // not a daily deposit sheet
    ws.getRow(1).eachCell((c) => { title ||= String(c.value ?? "").trim(); });
    const lines = new Map<number, string>(), headed = new Set<number>(); // lines: column -> line name
    ws.getRow(head).eachCell((c, n) => {
      const t = String(c.value ?? "").trim().replace(/\s+/g, " ").toLowerCase(); // not c.text: ExcelJS throws on a merged cell whose first cell is empty
      if (t) { headed.add(n); lastHeading = Math.max(lastHeading, n); }
      if (t === "gross sales") grossCol = n;
      if (n >= bank && t && t !== "date of deposit" && t !== "gross sales") lines.set(n, isBankDepositLine(t) ? BANK_DEPOSITS_LINE : t[0].toUpperCase() + t.slice(1));
    });
    const days: Day[] = [], slashDates: string[] = [];
    let ended = false; // ended: the totals and notes below the last day have started
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= head || ended) return;
      const where = `${sheet}, row ${i}`;
      const dateCell: unknown = row.getCell(bank - 1).value; // the date column sits left of "Bank Deposits" and has no heading; dates are =previous+1 formulas
      let date = cellDate(dateCell as ExcelJS.CellValue, where);
      if (!date) {
        if (dateCell && typeof dateCell === "object" && !(dateCell instanceof Date)) throw new Error(`${where}: the date was never calculated. Open the file in Excel, let it calculate, save it and upload again.`);
        ended = days.length > 0;
        return;
      }
      if (isSlashDateCell(dateCell as ExcelJS.CellValue)) slashDates.push(date);
      if (date < "2000" && named?.year) date = `${named.year}-${named.month}-${String(i - head).padStart(2, "0")}`; // typed without a year, so Excel stored 1900; rows run day 1, 2, 3...
      const values: [string, number][] = [], unlabelled: [number, number][] = [];
      let printed: number | null = null;
      try {
        for (const [n, line] of lines) { const v = num(row.getCell(n).value, `${where}, ${line}`); if (v !== null) values.push([line, v]); }
        if (grossCol) printed = num(row.getCell(grossCol).value, `${where}, Gross sales`);
        for (let n = bank + 1; n < lastHeading; n++) { if (headed.has(n)) continue; const v = num(row.getCell(n).value, `${where}, column ${n}`); if (v) unlabelled.push([n, v]); }
      } catch (e) {
        issues.push({ sheet, row: i, reason: (e as Error).message, loaded: false });
        return;
      }
      days.push({ date, values, row: i, printed, unlabelled });
    });
    checkSlashDatesOnSheet(slashDates, sheet);
    // A 30-day month still has 31 rows; the extra one carries a date from the next (or wrong) month and only zeros. Keep the days of the month most rows belong to.
    const perMonth = new Map<string, number>();
    for (const d of days) perMonth.set(d.date.slice(0, 7), (perMonth.get(d.date.slice(0, 7)) ?? 0) + 1);
    const month = [...perMonth].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (month && month < String(fromYear)) continue;
    const hasFigures = (d: Day) => d.values.some(([, v]) => v !== 0);
    if (month && named && days.some(hasFigures) && (month.slice(5) !== named.month || (named.year && month.slice(0, 4) !== named.year))) {
      issues.push({ sheet, row: head, reason: `The sheet is named ${sheet} but its dates are in ${month}, so it was not loaded.`, loaded: false });
      continue;
    }
    const stray = days.find((d) => d.date.slice(0, 7) !== month && hasFigures(d));
    if (stray) throw new Error(`${sheet} has figures dated ${stray.date}, which is outside the sheet's month. Correct the date.`);
    const own = days.filter((d) => d.date.slice(0, 7) === month), last = own.findLastIndex(hasFigures);
    if (last >= 0) sheets.push({ name: sheet, days: own, last });
  }
  const latest = sheets.map((x) => x.days[0].date).sort().at(-1);
  for (const x of sheets) {
    for (const d of x.days.slice(0, x.days[0].date === latest ? x.last + 1 : undefined)) { // only the newest sheet has unfilled days at its end
      const other = seen.get(d.date);
      if (other) throw new Error(`${x.name} and ${other} both have the date ${d.date}. Correct the dates in one of the two sheets.`);
      seen.set(d.date, x.name);
      for (const [line, value] of d.values) rows.push({ date: d.date, line, value });
      rowsRead++;
      controlTotal = roundMoney(controlTotal + (d.printed ?? 0));
      const gross = sumMoney(d.values.filter(([line]) => !isBankDepositLine(line)).map(([, v]) => v));
      if (d.printed !== null && Math.abs(gross - d.printed) > 0.05) issues.push({ sheet: x.name, row: d.row, reason: `${d.date}: the channels add up to ${gross} but the sheet's Gross Sales says ${d.printed}.`, loaded: true });
      for (const [n, v] of d.unlabelled) issues.push({ sheet: x.name, row: d.row, reason: `${d.date}: column ${n} holds ${v} but has no heading, so that figure was not loaded.`, loaded: true });
    }
  }
  return { title, rows, issues, rowsRead, controlTotal };
}

// Only the top block of each COGS sheet: its second block repeats the same stock and purchase figures month after month (April, September and October are identical).
const COGS_LINES = [["gross sales", "Gross sales", 1], ["disc sales", "Discount", -1], ["net sales", "Net sales", 1], ["cpu transfer", "CPU transfer", -1], ["stock tb", "Stock GL balance", 1], ["closing inventory", "Closing inventory", 1], ["cogs", "COGS", -1]] as const;
export type CogsRow = { year: number; month: number; branch: string; line: string; value: number };

const DUKAN_LINES = [["credit card", "Credit card sales"], ["credit", "Credit sales"], ["cash", "Cash sales"]] as const;

/** Daily takings from the "TOTAL" sheet of the monthly Dukan Food workbook (one row per day: card, credit, cash, total). Stored like a restaurant's daily deposit.
 *  The workbook also comes as a copy with old January 2022 dates over the current numbers: fromYear leaves those rows out, and a heading that disagrees with the dates refuses the file.
 *  Days after the last day with a figure are the unfilled rest of the month, so they are skipped; every other zero is a real zero. */
export function dukanFromWorkbook(wb: ExcelJS.Workbook, fromYear = 0) {
  const ws = wb.worksheets.find((w) => /^total/i.test(w.name.trim()));
  if (!ws) throw new Error("This file has no TOTAL sheet - is this the Dukan Food monthly workbook?");
  const sheet = ws.name.trim(), col = new Map<string, number>();
  let head = 0, title = "";
  for (let i = 1; i <= 6 && !head; i++) {
    ws.getRow(i).eachCell((c, n) => { const t = fold(String(c.value ?? "")); if (t === "date") head = i; if (t) col.set(t, n); });
    if (!head) { title += ` ${[...col.keys()].join(" ")}`; col.clear(); }
  }
  if (!head || !title.includes("dukan") || !col.has("total")) throw new Error("This is not the Dukan Food sales layout (a Date column under a Dukan Food heading).");
  const issues: ImportIssue[] = [], days: { date: string; row: number; total: number | null; values: [string, number][] }[] = [], slashDates: string[] = [];
  let ended = false;
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i <= head || ended) return;
    const where = `${sheet}, row ${i}`, rawDateCell = row.getCell(col.get("date")!).value, date = cellDate(rawDateCell, where);
    if (!date) { ended = days.length > 0; return; }
    if (isSlashDateCell(rawDateCell)) slashDates.push(date);
    if (date < String(fromYear)) return;
    try {
      const values: [string, number][] = [];
      for (const [key, line] of DUKAN_LINES) { const v = num(row.getCell(col.get(key) ?? 0).value, `${where}, ${line}`); if (v !== null) values.push([line, v]); }
      days.push({ date, row: i, total: num(row.getCell(col.get("total")!).value, `${where}, Total`), values });
    } catch (e) { issues.push({ sheet, row: i, reason: (e as Error).message, loaded: false }); }
  });
  checkSlashDatesOnSheet(slashDates, sheet);
  const named = title.match(/month of ([a-z]{3})[a-z]*\s*-?\s*(\d{4})/), last = days.findLastIndex((d) => d.values.some(([, v]) => v !== 0));
  const kept = days.slice(0, last + 1);
  if (named && kept.some((d) => d.date.slice(0, 7) !== `${named[2]}-${String(MONTHS.findIndex((m) => m.toLowerCase() === named[1]) + 1).padStart(2, "0")}`)) throw new Error(`The sheet heading says ${named[1]} ${named[2]} but its dates are in another month. Correct the file.`);
  const rows: ReceiptRow[] = [];
  let controlTotal = 0;
  for (const d of kept) {
    for (const [line, value] of d.values) rows.push({ date: d.date, line, value });
    controlTotal = roundMoney(controlTotal + (d.total ?? 0));
    const sum = sumMoney(d.values.map(([, v]) => v));
    if (d.total !== null && Math.abs(sum - d.total) > 0.05) issues.push({ sheet, row: d.row, reason: `${d.date}: card, credit and cash add up to ${sum} but the sheet's Total says ${d.total}.`, loaded: true });
  }
  return { rows, issues, rowsRead: kept.length, controlTotal };
}

/** Legacy fallback mappings for historical COGS columns when app.companies.aliases / app.branches.aliases have not been populated yet. */
const COGS_COLUMNS: Record<string, { company: string; branch?: string[] }> = {
  "burger stop": { company: "burger stop" },
  "mr.shawarma bin omran": { company: "shawarma", branch: ["bin omran"] },
  "mr.shawarma um salal": { company: "shawarma", branch: ["umm salal", "um salal"] }, // closed branch, its months stay as history
  "mr.shawarma musherib": { company: "shawarma", branch: ["musherib"] },
  "ms 43": { company: "shawarma", branch: ["ms 43"] }, // Jan to May 2024 only
  "mr.shawarma gharafa": { company: "shawarma", branch: ["gharafa"] },
  "abu hamour": { company: "shawarma", branch: ["abu hamour"] },
  "west bay": { company: "shawarma", branch: ["qatar sports club", "west bay", "westbay"] },
  "asian wok old airport": { company: "asian wok" },
};

/** Columns the workbook drops but the owner wants as a verified zero (Musherib is not in DEC-2024: its figures moved to the Burger Stop column). shortcut: one fixed entry, move it to the data if it happens again. */
const COGS_ZERO_MONTHS = [{ year: 2024, month: 11, branch: "Mr.Shawarma Musherib" }];

/** The COGS rows of one company, each with its branch id (null = the whole company). The workbook covers several companies, so it is uploaded once on each. Columns of other companies are skipped. */
export function cogsForCompany(rows: CogsRow[], companyName: string, branches: { id: number; name: string; aliases?: string[] }[], companyAliases: string[] = []) {
  const company = fold(companyName), ownAliases = companyAliases.map(fold), mine: (CogsRow & { branchId: number | null })[] = [], issues: ImportIssue[] = [], resolved = new Map<string, number | null | undefined>();
  for (const r of rows) {
    if (!resolved.has(r.branch)) {
      const col = fold(r.branch);
      const byAlias = branches.find((b) => (b.aliases ?? []).some((a) => fold(a) === col));
      if (byAlias) resolved.set(r.branch, byAlias.id);
      else if (col === company || ownAliases.includes(col)) resolved.set(r.branch, null);
      else {
        const owner = COGS_COLUMNS[col];
        if (!owner) { issues.push({ sheet: "", row: 0, reason: `The column "${r.branch}" has no confirmed owner, so it was not loaded.`, loaded: false }); resolved.set(r.branch, undefined); continue; }
        if (!company.includes(owner.company)) { resolved.set(r.branch, undefined); continue; }
        const branch = owner.branch ? branches.find((b) => [b.name, ...(b.aliases ?? [])].some((t) => owner.branch!.some((n) => fold(t).includes(n)))) : null;
        if (branch === undefined) throw new Error(`${companyName} has no branch for the column "${r.branch}". Add the branch first.`);
        resolved.set(r.branch, branch?.id ?? null);
      }
    }
    const branchId = resolved.get(r.branch);
    if (branchId !== undefined) mine.push({ ...r, branchId });
  }
  return { rows: mine, issues };
}

/** Monthly cost of goods per restaurant from the group "Restaurants COGS Summary" workbook. Only sheets named like OCT-2026 (or "MAY-2024 (2)") are read, the rest are old workings.
 *  Costs are negative. A column with no Gross Sales that month is left out: a closed branch, or the central kitchen, which only passes stock to the branches. Cost % is calculated when read, never stored. */
export function cogsFromWorkbook(wb: ExcelJS.Workbook, fromYear = 0) {
  const rows: CogsRow[] = [], issues: ImportIssue[] = [];
  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim(), named = sheet.match(/^([A-Za-z]{3})-(\d{4})(?:\s*\(\d+\))?$/), month = named ? MONTHS.findIndex((m) => m.toLowerCase() === named[1].toLowerCase()) : -1;
    if (!named || month < 0 || +named[2] < fromYear) continue;
    let head = 0, label = 0;
    for (let i = 1; i <= 6 && !head; i++) ws.getRow(i).eachCell((c, n) => { if (fold(String(c.value ?? "")) === "description") { head = i; label = n; } });
    if (!head) continue;
    const branches = new Map<number, string>();
    ws.getRow(head).eachCell((c, n) => { const t = String(c.value ?? "").replace(/\s+/g, " ").trim(); if (n > label && t && fold(t) !== "total") branches.set(n, t); });
    const found = new Map<string, { row: number; values: Map<number, number> }>();
    for (let i = head + 1; i <= head + 15 && found.size < COGS_LINES.length; i++) {
      const row = ws.getRow(i), text = fold(String(row.getCell(label).value ?? "")), line = COGS_LINES.find(([key]) => text === key || (key !== "cogs" && text.startsWith(key)));
      if (!line || found.has(line[1])) continue;
      const values = new Map<number, number>();
      for (const n of branches.keys()) { const v = num(row.getCell(n).value, `${sheet}, row ${i}, ${branches.get(n)}`); if (v !== null) values.set(n, v); }
      found.set(line[1], { row: i, values });
    }
    const gross = found.get("Gross sales");
    if (!gross) { issues.push({ sheet, row: head, reason: "No Gross Sales row, so the sheet was not loaded.", loaded: false }); continue; }
    for (const [n, branch] of branches) {
      if (!gross.values.get(n)) continue;
      for (const [, line, sign] of COGS_LINES) { const v = found.get(line)?.values.get(n); if (v !== undefined) rows.push({ year: +named[2], month, branch, line, value: roundMoney(sign * v) }); }
      const net = found.get("Net sales")?.values.get(n), discount = found.get("Discount")?.values.get(n) ?? 0, expected = roundMoney(gross.values.get(n)! - discount);
      if (net !== undefined && Math.abs(net - expected) > 0.05) issues.push({ sheet, row: found.get("Net sales")!.row, reason: `${branch}: gross less discount is ${expected} but Net Sales says ${net}.`, loaded: true });
    }
    for (const z of COGS_ZERO_MONTHS) {
      if (z.year === +named[2] && z.month === month && !rows.some((r) => r.year === z.year && r.month === z.month && r.branch === z.branch)) for (const line of ["Gross sales", "Discount", "Net sales", "COGS"]) rows.push({ ...z, line, value: 0 });
    }
  }
  return { rows, issues };
}
