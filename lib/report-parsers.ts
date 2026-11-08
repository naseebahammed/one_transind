// Reads uploaded company report workbooks (P&L, daily stay report, unit-type report) into rows. Amounts in QAR: revenue positive, costs negative.
// Pure (no database) so `node --test` can load it.
import type ExcelJS from "exceljs";

import { MONTHS } from "./format.ts";

const round = (v: number) => Math.round(v * 100) / 100;

/** Numeric value of a cell, or null when blank. Formula cells give their result; CSV text like "1,234" or "(50)" is read as a number. Anything else throws, so a bad cell is never loaded as 0. */
export function num(v: ExcelJS.CellValue, where: string): number | null {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return round(x);
  if (typeof x === "object" && ("formula" in x || "sharedFormula" in x)) return null; // a formula Excel never calculated has no value yet
  const raw = typeof x === "object" && "richText" in x ? (x as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("") : typeof x === "string" ? x : String((x as { error?: string }).error ?? x);
  const t = raw.trim();
  if (!t || t === "-") return null;
  const neg = /^\(.*\)$/.test(t), n = Number((neg ? t.slice(1, -1) : t).replaceAll(",", ""));
  if (t === "" || !Number.isFinite(n)) throw new Error(`${where}: "${t}" is not a number.`);
  return round(neg ? -n : n);
}

/** "YYYY-MM-DD" from a date cell, ISO text or dd/mm/yyyy text (what Excel writes to CSV here), or null for a cell that is not a date. */
export function cellDate(v: ExcelJS.CellValue, where: string) {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  const t = String(x ?? "").trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/), dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!iso && !dmy) return null;
  const date = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : `${dmy![3]}-${dmy![2].padStart(2, "0")}-${dmy![1].padStart(2, "0")}`;
  const d = new Date(`${date}T00:00:00Z`);
  if (isNaN(+d) || d.toISOString().slice(0, 10) !== date) throw new Error(`${where}: "${t}" is not a real date.`);
  return date;
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

/** P&L figures from the first visible sheet with month columns (the workbook can carry hidden prior-year sheets first). Only months holding a non-zero figure are returned, so an empty or all-zero column leaves that month on file untouched. */
export function pnlFromWorkbook(wb: ExcelJS.Workbook, formYear: number): { error: string } | { rows: PnlLine[] } {
  const colMonth = new Map<number, number>(), colYear = new Map<number, number>();
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
    if (cur) cur.value = round(cur.value + r.value);
    else out.set(k, { ...r, main: a.main, line: a.sub });
  }
  if (unknown.size) return { error: `Not in the chart of accounts: ${[...unknown].slice(0, 5).join("; ")}${unknown.size > 5 ? ` and ${unknown.size - 5} more` : ""}. Fix the name, or add it under Chart of accounts first.` };
  return { rows: [...out.values()] };
}

export type DailyRow = { date: string; long_guests: number; long_rate: number; long_total: number; short_guests: number; short_rate: number; short_total: number; rooms_occupied: number; room_revenue: number; other_revenue: number; rooms_available: number };

/** Daily rows from every sheet of a sales workbook. Columns are found by header text, so the 2024/25 layout (blank spacer column, no "Other Revenue") and the 2026 one both load.
 *  shortcut: a day with no guests at all is skipped as "not yet happened", so a genuinely empty day is not recorded - fine for a hotel that is always open. */
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
    const titleYm = sheetYm(ws);
    let remap: boolean | undefined, day = 0, prevTotal = 0, running: boolean | undefined; // running: "Total Revenue" is a month-to-date total (Al Manzil 2023-25), not a per-day figure
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= head) return;
      let date = cellDate(row.getCell(1).value, `${ws.name}, row ${i}`); // date cells are often =previous+1 formulas
      if (!date) return; // title, sub total and blank rows have no date
      remap ??= !!titleYm && date.slice(0, 7) !== titleYm;
      if (remap) date = `${titleYm}-${String(++day).padStart(2, "0")}`;
      const n = (k: number) => (k ? num(row.getCell(k).value, `${ws.name}, row ${i}`) ?? 0 : 0);
      const longG = n(c.lg), shortG = n(c.sg);
      if (!longG && !shortG) return;
      const longT = n(c.lg + 2), shortT = n(c.sg + 2);
      const occupied = n(c.occ) || longG + shortG;
      const roomRev = n(c.rev) || longT + shortT;
      if (c.total && !c.other) { const t = n(c.total); if (prevTotal) running ??= Math.abs(t - prevTotal - roomRev) < 1; prevTotal = t; }
      out.push({ date, long_guests: longG, long_rate: n(c.lg + 1), long_total: longT, short_guests: shortG, short_rate: n(c.sg + 1), short_total: shortT, rooms_occupied: occupied, room_revenue: roomRev,
        other_revenue: c.other ? n(c.other) : c.total && !running ? round(n(c.total) - roomRev) : 0, // 120 Al Sadd has Supermarket/Spa inside Total Revenue, no "other revenue" column
        rooms_available: n(c.avl) });
    });
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
    const titleYm = sheetYm(ws);
    let remap: boolean | undefined, day = 0;
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= g + 1) return;
      const where = `${ws.name}, row ${i}`;
      let date = cellDate(row.getCell(dateCol).value, where);
      if (!date) return;
      remap ??= !!titleYm && date.slice(0, 7) !== titleYm;
      if (remap) date = `${titleYm}-${String(++day).padStart(2, "0")}`;
      if (!cols.some((x) => (x.metric === "Long stay" || x.metric === "Short stay") && num(row.getCell(x.col).value, where))) return; // no guests = day not yet happened
      const year = +date.slice(0, 4), month = +date.slice(5, 7) - 1;
      for (const x of cols) {
        if (!x.type) throw new Error(`${ws.name}: the ${x.metric} column ${x.col} has no unit type above it.`);
        const k = `${year},${month},${x.type},${x.metric}`;
        const a = acc.get(k) ?? acc.set(k, { year, month, unit_type: x.type, line: x.metric, value: 0 }).get(k)!;
        a.value = round(a.value + (num(row.getCell(x.col).value, where) ?? 0));
      }
    });
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
    for (let i = 1; i <= 6 && !head; i++) ws.getRow(i).eachCell((c, n) => { if (String(c.value ?? "").trim().toLowerCase() === "bank deposits") { head = i; bank = n; } });
    if (!head) continue; // not a daily deposit sheet
    ws.getRow(1).eachCell((c) => { title ||= String(c.value ?? "").trim(); });
    const lines = new Map<number, string>(), headed = new Set<number>(); // lines: column -> line name
    ws.getRow(head).eachCell((c, n) => {
      const t = String(c.value ?? "").trim().replace(/\s+/g, " ").toLowerCase(); // not c.text: ExcelJS throws on a merged cell whose first cell is empty
      if (t) { headed.add(n); lastHeading = Math.max(lastHeading, n); }
      if (t === "gross sales") grossCol = n;
      if (n >= bank && t && t !== "date of deposit" && t !== "gross sales") lines.set(n, t[0].toUpperCase() + t.slice(1));
    });
    const days: Day[] = [];
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
      controlTotal = round(controlTotal + (d.printed ?? 0));
      const gross = round(d.values.reduce((s, [line, v]) => (line === "Bank deposits" ? s : s + v), 0));
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
  const issues: ImportIssue[] = [], days: { date: string; row: number; total: number | null; values: [string, number][] }[] = [];
  let ended = false;
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i <= head || ended) return;
    const where = `${sheet}, row ${i}`, date = cellDate(row.getCell(col.get("date")!).value, where);
    if (!date) { ended = days.length > 0; return; }
    if (date < String(fromYear)) return;
    try {
      const values: [string, number][] = [];
      for (const [key, line] of DUKAN_LINES) { const v = num(row.getCell(col.get(key) ?? 0).value, `${where}, ${line}`); if (v !== null) values.push([line, v]); }
      days.push({ date, row: i, total: num(row.getCell(col.get("total")!).value, `${where}, Total`), values });
    } catch (e) { issues.push({ sheet, row: i, reason: (e as Error).message, loaded: false }); }
  });
  const named = title.match(/month of ([a-z]{3})[a-z]*\s*-?\s*(\d{4})/), last = days.findLastIndex((d) => d.values.some(([, v]) => v !== 0));
  const kept = days.slice(0, last + 1);
  if (named && kept.some((d) => d.date.slice(0, 7) !== `${named[2]}-${String(MONTHS.findIndex((m) => m.toLowerCase() === named[1]) + 1).padStart(2, "0")}`)) throw new Error(`The sheet heading says ${named[1]} ${named[2]} but its dates are in another month. Correct the file.`);
  const rows: ReceiptRow[] = [];
  let controlTotal = 0;
  for (const d of kept) {
    for (const [line, value] of d.values) rows.push({ date: d.date, line, value });
    controlTotal = round(controlTotal + (d.total ?? 0));
    const sum = round(d.values.reduce((s, [, v]) => s + v, 0));
    if (d.total !== null && Math.abs(sum - d.total) > 0.05) issues.push({ sheet, row: d.row, reason: `${d.date}: card, credit and cash add up to ${sum} but the sheet's Total says ${d.total}.`, loaded: true });
  }
  return { rows, issues, rowsRead: kept.length, controlTotal };
}

/** Who each COGS column belongs to. shortcut: hard-coded for the columns the workbook has today, a new column is reported and not loaded until it is added here.
 *  "Burger Stop" is the Burger Stop company as a whole, confirmed by the owner, even though its sales are about five times the company's two deposit books. */
const COGS_COLUMNS: Record<string, { company: string; branch?: string[] }> = {
  "burger stop": { company: "burger stop" },
  "mr.shawarma bin omran": { company: "shawarma", branch: ["bin omran"] },
  "mr.shawarma gharafa": { company: "shawarma", branch: ["gharafa"] },
  "abu hamour": { company: "shawarma", branch: ["abu hamour"] },
  "west bay": { company: "shawarma", branch: ["qatar sports club", "west bay", "westbay"] },
  "asian wok old airport": { company: "asian wok" },
};

/** The COGS rows of one company, each with its branch id (null = the whole company). The workbook covers several companies, so it is uploaded once on each. Columns of other companies are skipped. */
export function cogsForCompany(rows: CogsRow[], companyName: string, branches: { id: number; name: string; aliases?: string[] }[], companyAliases: string[] = []) {
  const company = fold(companyName), ownAliases = companyAliases.map(fold), mine: (CogsRow & { branchId: number | null })[] = [], issues: ImportIssue[] = [], resolved = new Map<string, number | null | undefined>();
  for (const r of rows) {
    if (!resolved.has(r.branch)) {
      const col = fold(r.branch);
      const byAlias = branches.find((b) => (b.aliases ?? []).some((a) => fold(a) === col));
      if (byAlias) resolved.set(r.branch, byAlias.id);
      else if (ownAliases.includes(col)) resolved.set(r.branch, null);
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

/** Monthly cost of goods per restaurant from the group "Restaurants COGS Summary" workbook. Only sheets named like OCT-2026 are read (the rest are old workings).
 *  Costs are negative. A column with no Gross Sales that month is left out: a closed branch, or the central kitchen, which only passes stock to the branches. Cost % is calculated when read, never stored. */
export function cogsFromWorkbook(wb: ExcelJS.Workbook, fromYear = 0) {
  const rows: CogsRow[] = [], issues: ImportIssue[] = [];
  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim(), named = sheet.match(/^([A-Za-z]{3})-(\d{4})$/), month = named ? MONTHS.findIndex((m) => m.toLowerCase() === named[1].toLowerCase()) : -1;
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
      for (const [, line, sign] of COGS_LINES) { const v = found.get(line)?.values.get(n); if (v !== undefined) rows.push({ year: +named[2], month, branch, line, value: round(sign * v) }); }
      const net = found.get("Net sales")?.values.get(n), discount = found.get("Discount")?.values.get(n) ?? 0, expected = round(gross.values.get(n)! - discount);
      if (net !== undefined && Math.abs(net - expected) > 0.05) issues.push({ sheet, row: found.get("Net sales")!.row, reason: `${branch}: gross less discount is ${expected} but Net Sales says ${net}.`, loaded: true });
    }
  }
  return { rows, issues };
}
