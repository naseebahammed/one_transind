// Company reports in QAR: parsers for uploaded workbooks and readers over app.company_figures and app.daily_sales. Revenue is positive, costs negative.
import type ExcelJS from "exceljs";

import { MONTHS, sum } from "./format.ts";

export { MONTHS, sum };
const round = (v: number) => Math.round(v * 100) / 100;

/** A company's key in the readers below. */
export const keyFor = (c: { id: number }) => String(c.id);

/** Numeric value of a cell, or null when blank. Formula cells give their result; CSV text like "1,234" or "(50)" is read as a number. Anything else throws, so a bad cell is never loaded as 0. */
export function num(v: ExcelJS.CellValue, where: string): number | null {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return round(x);
  if (typeof x === "object" && "formula" in x) return null; // a formula Excel never calculated has no value yet
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

export type PnlLine = { year: number; month: number; main: string; line: string; value: number };

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
export type UnitLine = { year: number; month: number; unit_type: string; line: string; value: number };

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

// Lowercase company name the Al Manzil panels look for (see the shortcut note in loadReports).
export const AL_MANZIL_NAME = "al manzil";

const db = () => import("@/lib/db"); // lazy so the pure helpers above stay loadable by `node --test` without the Next alias

type Row = { year: number; main: string; sub: string; m: number[] };
type Day = Omit<DailyRow, "date"> & { date: string };
type Kind = "pnl" | "sales" | "units";
type Key = string | string[];
// The readers below are synchronous over a snapshot; every page/route that uses them calls `await loadReports()` first, so an upload shows up on the next request.
let snap: { rows: Map<string, Row[]>; daily: Map<string, Day[]>; alManzil: string } | null = null;

/** Load every company's figures from the database. `query` is only passed by tests, to run without a database. */
export async function loadReports(query?: <T>(text: string) => Promise<T[]>) {
  const q = query ?? (await db()).q;
  const NUMS = "long_guests,long_rate,long_total,short_guests,short_rate,short_total,rooms_occupied,room_revenue,other_revenue,rooms_available";
  const [figures, derived, days, co] = await Promise.all([
    q<{ id: number; section: Kind; y: number; mo: number; main: string; line: string; unit_type: string; v: number }>(
      `SELECT f.company_id AS id, f.section, EXTRACT(year FROM f.period)::int AS y, EXTRACT(month FROM f.period)::int - 1 AS mo, f.main, f.line, f.unit_type, f.value::float8 AS v
       FROM app.company_figures f JOIN app.accounts a ON a.section=f.section AND a.main=f.main AND a.sub=f.line
       WHERE f.section IN ('pnl','sales','units') ORDER BY a.main_order, a.id`),
    q<{ id: number; y: number; mo: number; main: string; line: string; v: number }>(
      `SELECT company_id AS id, EXTRACT(year FROM period)::int AS y, EXTRACT(month FROM period)::int - 1 AS mo, main, line, value::float8 AS v
       FROM app.daily_sales_monthly ORDER BY array_position(ARRAY['Long stay','Short stay','Room revenue','Other revenue','Occupied','Available'], line)`),
    q<Day & { id: number }>(`SELECT company_id AS id, to_char(date,'YYYY-MM-DD') AS date, ${NUMS.split(",").map((c) => `${c}::float8 AS ${c}`).join(",")} FROM app.daily_sales ORDER BY date`),
    // shortcut: the Al Manzil panels on /finance, /admin/finance and Ask find it by name; give them a company picker to drop this.
    q<{ id: number }>(`SELECT id FROM app.companies WHERE lower(name) LIKE '${AL_MANZIL_NAME}%' ORDER BY id LIMIT 1`),
  ]);
  const rows = new Map<string, Row[]>(), index = new Map<string, Row>();
  const put = (id: number, kind: Kind, y: number, main: string, sub: string, mo: number, v: number) => {
    const k = `${id}|${kind}|${y}|${main}|${sub}`;
    let r = index.get(k);
    if (!r) {
      index.set(k, r = { year: y, main, sub, m: Array<number>(12).fill(0) });
      const list = `${id}|${kind}`;
      rows.set(list, [...(rows.get(list) ?? []), r]);
    }
    r.m[mo] = v;
  };
  for (const f of figures) put(f.id, f.section, f.y, f.section === "units" ? f.unit_type : f.main, f.line, f.mo, f.v);
  for (const d of derived) put(d.id, "sales", d.y, d.main, d.line, d.mo, d.v);
  const daily = new Map<string, Day[]>();
  for (const { id, ...d } of days) daily.set(String(id), [...(daily.get(String(id)) ?? []), d]);
  snap = { rows, daily, alManzil: co[0] ? String(co[0].id) : "" };
}
const loaded = () => {
  if (!snap) throw new Error("loadReports() must be awaited before reading reports.");
  return snap;
};
/** Key of the company the Al Manzil panels show. */
export const alManzilKey = () => loaded().alManzil;

const load = (key: Key, kind: Kind = "pnl") => (Array.isArray(key) ? key : [key]).flatMap((k) => loaded().rows.get(`${k}|${kind}`) ?? []);
const daysOf = (key: Key) => (Array.isArray(key) ? key : [key]).flatMap((k) => loaded().daily.get(k) ?? []);
export const years = (key: Key, kind: Kind = "pnl") => [...new Set(load(key, kind).map((x) => x.year))].sort();
const add = (a: number[], b: number[], s = 1) => a.map((v, i) => v + s * b[i]);
const zero = () => Array<number>(12).fill(0);

export function report(year: number, key: Key, rows = load(key)) {
  const r = rows.filter((x) => x.year === year);
  const by = new Map<string, number[]>();
  for (const x of r) if (x.main !== "REVENUE") by.set(x.main, add(by.get(x.main) ?? zero(), x.m, -1));
  const costGroups = [...by].filter(([, v]) => sum(v) !== 0).map(([k, v]) => [label[k] ?? k, v] as [string, number[]]);
  const revenue = r.filter((x) => x.main === "REVENUE").reduce((a, x) => add(a, x.m), zero());
  const totalCost = costGroups.reduce((a, [, v]) => add(a, v), zero());
  const roomRent = r.find((x) => x.sub === "Room Rent")?.m ?? zero();
  return { revenue, roomRent, totalCost, net: add(revenue, totalCost, -1), costGroups };
}

const label: Record<string, string> = {
  "FINANCE COST": "Finance cost", "DEPRECIATION PPE": "Depreciation", "STAFF COST": "Staff cost", "REPAIR AND MAINTENANCE EXP": "Repair & maintenance",
  "UTILITY EXPENSES": "Utilities", "CLEANING EXP": "Cleaning", "COMPUTER & STATIONERY": "Computer & stationery", "INSURANCE EXP": "Insurance",
  "MISCELLANEOUS": "Miscellaneous", "MARKETING & ADVERTISING": "Marketing", "VEHICLE EXPENSES": "Vehicle", "LEGAL AND PROFESSIONAL EXP": "Legal & professional",
};

/** Revenue by account line (room rent, space rental, ...) for one year, non-zero lines only. */
export const revenueLines = (year: number, key: Key) =>
  load(key).filter((x) => x.year === year && x.main === "REVENUE").map((x) => [x.sub, sum(x.m)] as [string, number]).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);

/** Per month for one year from the daily long/short stay sales report: occupancy %, average daily rate, rooms sold, long/short guests, other revenue. */
export function occupancy(year: number, key: Key) {
  const days = daysOf(key).filter((d) => d.date.startsWith(`${year}-`));
  return MONTHS.map((_, m) => {
    const d = days.filter((x) => +x.date.slice(5, 7) === m + 1);
    const total = (k: keyof Omit<Day, "date">) => sum(d.map((x) => x[k]));
    const lg = total("long_guests"), sg = total("short_guests"), sold = total("rooms_occupied"), avail = total("rooms_available"), room = total("room_revenue"), other = total("other_revenue");
    return { days: d.length, sold, avail, occ: avail ? sold / avail : 0, adr: sold ? room / sold : 0, longShare: sold ? lg / (lg + sg) : 0, room, other };
  });
}

/** Years actually covered by the daily report - the P&L can have years the stay report doesn't (and vice versa), so the stay report's year picker needs its own list. */
export const dailyYears = (key: Key) => [...new Set(daysOf(key).map((d) => +d.date.slice(0, 4)))].sort();

/** Detail account rows of one year, for the monthly grids. */
export const plRows = (year: number, key: Key, kind: Kind = "pnl") => load(key, kind).filter((x) => x.year === year);
