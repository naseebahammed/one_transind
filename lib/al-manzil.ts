// Al Manzil P&L (QAR), Jan-Dec (monthly statements 2024-2025). Costs are positive here.
// Each "file" below is a CSV text stored as a row of app.report_files; the data/*.csv files only seed it.
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import type ExcelJS from "exceljs";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export const AL_MANZIL_KEY = "al-manzil";
/** File key for a company's P&L/daily data: Al Manzil keeps its original filenames, every other company is keyed by id. */
export const keyFor = (c: { id: number; name: string }) => (c.name.trim().toLowerCase() === "al manzil" ? AL_MANZIL_KEY : String(c.id));
export const pnlPath = (key: string) => (key === AL_MANZIL_KEY ? "al-manzil.csv" : `pl-${key}.csv`);
export const dailyPath = (key: string) => (key === AL_MANZIL_KEY ? "al-manzil-daily.csv" : `daily-${key}.csv`);
/** Monthly sales totals, P&L-shaped (year,main,sub,Jan..Dec) - edited directly, same as the P&L grid. The daily file stays the source for occupancy/ADR elsewhere. */
export const salesPath = (key: string) => (key === AL_MANZIL_KEY ? "al-manzil-sales.csv" : `sales-${key}.csv`);
export const PNL_HEADER = "year,main,sub," + MONTHS.join(",");
export const DAILY_HEADER = "date,long_guests,long_rate,long_total,short_guests,short_rate,short_total,rooms_occupied,room_revenue,other_revenue,avg_rate,rooms_available,occ";

/** Numeric value of a cell; formula cells carry their cached result. Blank or non-numeric reads as 0. */
export const num = (v: ExcelJS.CellValue) => {
  const x = typeof v === "object" && v && "result" in v ? v.result : v;
  return typeof x === "number" ? Math.round(x * 100) / 100 : 0;
};

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

/** Daily CSV rows (no header) from every sheet of a sales workbook. Columns are found by header text, so the 2024/25 layout (blank spacer column, no "Other Revenue") and the 2026 one both load.
 *  shortcut: a day with no guests at all is skipped as "not yet happened", so a genuinely empty day is not recorded - fine for a hotel that is always open. */
export function dailyFromWorkbook(wb: ExcelJS.Workbook) {
  const lines: string[] = [];
  for (const ws of wb.worksheets) {
    const col = new Map<string, number>();
    let head = 0;
    for (let i = 1; i <= 5 && !head; i++) {
      ws.getRow(i).eachCell((c) => { if (String(c.value ?? "").trim().toLowerCase() === "date") head = i; });
    }
    if (!head) continue; // not a daily sheet
    ws.getRow(head).eachCell((c, n) => { const t = String(c.value ?? "").trim().toLowerCase(); if (t && !col.has(t)) col.set(t, n); });
    const at = (name: string, off = 0) => { const n = col.get(name); return n ? n + off : 0; };
    const revCol = [...col].find(([t]) => t.includes("daily revenue"))?.[1] ?? 0;
    const c = { lg: at("long stay guests"), sg: at("short stay guests"), occ: at("total room occupancy"), rev: revCol, other: at("other revenue"), total: at("total revenue"), adr: at("daily avg rate"), avl: at("rms/avl.") };
    if (!c.lg || !c.sg || !revCol) continue;
    const titleYm = sheetYm(ws);
    let remap: boolean | undefined, day = 0, prevTotal = 0, running: boolean | undefined; // running: "Total Revenue" is a month-to-date total (Al Manzil 2023-25), not a per-day figure
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= head) return;
      const raw = row.getCell(1).value;
      const dv = raw && typeof raw === "object" && "result" in raw ? raw.result : raw; // date cells are often =previous+1 formulas
      let date = dv instanceof Date ? dv.toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}/.test(String(dv ?? "").trim()) ? String(dv).trim().slice(0, 10) : null;
      if (!date) return; // title, sub total and blank rows have no date
      remap ??= !!titleYm && date.slice(0, 7) !== titleYm;
      if (remap) date = `${titleYm}-${String(++day).padStart(2, "0")}`;
      const n = (k: number) => (k ? num(row.getCell(k).value) : 0);
      const longG = n(c.lg), shortG = n(c.sg);
      if (!longG && !shortG) return;
      const longT = n(c.lg + 2), shortT = n(c.sg + 2);
      const occupied = n(c.occ) || longG + shortG, avail = n(c.avl);
      const roomRev = n(c.rev) || longT + shortT;
      if (c.total && !c.other) { const t = n(c.total); if (prevTotal) running ??= Math.abs(t - prevTotal - roomRev) < 1; prevTotal = t; }
      lines.push([date, longG, n(c.lg + 1), longT, shortG, n(c.sg + 1), shortT, occupied, roomRev, c.other ? n(c.other) : c.total && !running ? Math.round((n(c.total) - roomRev) * 100) / 100 : 0, // 120 Al Sadd has Supermarket/Spa inside Total Revenue, no "other revenue" column
         n(c.adr) || (occupied ? Math.round((roomRev / occupied) * 100) / 100 : 0), avail, avail ? Math.round((occupied / avail) * 10000) / 10000 : 0].join(","));
    });
  }
  return lines;
}

export const unitsPath = (key: string) => `units-${key}.csv`;
const UNIT_METRICS = [["availability", "Available"], ["long stay", "Long stay"], ["short stay", "Short stay"], ["revenue", "Room revenue"]] as const;

/** Monthly totals per unit type (e.g. "1 BHK") from a unit-type sales workbook, P&L-shaped, plus the "year-monthIndex" keys it covers.
 *  Layout: a group header row (Availability / Long Stay / Short Stay / ... Revenue) over a row naming the unit type in each column. */
export function unitsFromWorkbook(wb: ExcelJS.Workbook) {
  const acc = new Map<string, number[]>(), months = new Set<string>();
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
      const raw = row.getCell(dateCol).value, dv = raw && typeof raw === "object" && "result" in raw ? raw.result : raw;
      let date = dv instanceof Date ? dv.toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}/.test(String(dv ?? "").trim()) ? String(dv).trim().slice(0, 10) : null;
      if (!date) return;
      remap ??= !!titleYm && date.slice(0, 7) !== titleYm;
      if (remap) date = `${titleYm}-${String(++day).padStart(2, "0")}`;
      if (!cols.some((x) => (x.metric === "Long stay" || x.metric === "Short stay") && num(row.getCell(x.col).value))) return; // no guests = day not yet happened
      const mi = +date.slice(5, 7) - 1;
      months.add(`${date.slice(0, 4)}-${mi}`);
      for (const x of cols) {
        const k = `${date.slice(0, 4)},${x.type},${x.metric}`;
        const a = acc.get(k) ?? acc.set(k, Array<number>(12).fill(0)).get(k)!;
        a[mi] += num(row.getCell(x.col).value);
      }
    });
  }
  return { lines: [...acc].map(([k, m]) => [k, ...m.map((v) => Math.round(v * 100) / 100)].join(",")), months };
}

/** Sales metrics kept in the monthly grid: [main, sub, column index in DAILY_HEADER]. Rates/occupancy stay derived, not stored - like a P&L total, never typed. */
const SALES_METRICS: [string, string, number][] = [
  ["GUESTS", "Long stay", 1], ["GUESTS", "Short stay", 4],
  ["REVENUE", "Room revenue", 8], ["REVENUE", "Other revenue", 9],
  ["ROOMS", "Occupied", 7], ["ROOMS", "Available", 11],
];
/** Aggregate a daily sales CSV's rows into one year's monthly totals per SALES_METRICS, P&L-shaped. */
export function aggregateSales(dailyCsv: string, year: number) {
  const days = dailyCsv.trim().split("\n").slice(1).map((l) => l.split(",")).filter((c) => c[0]?.startsWith(`${year}-`));
  return SALES_METRICS.map(([main, sub, col]) => {
    const m = Array<number>(12).fill(0);
    for (const d of days) m[+d[0].slice(5, 7) - 1] += +d[col];
    return [year, main, sub, ...m.map((v) => Math.round(v * 100) / 100)].join(",");
  });
}

/** Existing daily CSV text with the uploaded days merged in (same date = replaced), sorted by date. Throws a readable message on a bad file. */
export function mergeDaily(existing: string, upload: string) {
  const rows = (t: string) => t.replace(/^﻿/, "").replace(/\r/g, "").trim().split("\n").filter(Boolean);
  const [head, ...lines] = rows(upload);
  if (head?.trim() !== DAILY_HEADER) throw new Error(`The first line must be exactly: ${DAILY_HEADER}`);
  const byDate = new Map(rows(existing).slice(1).map((l) => [l.split(",")[0], l]));
  const n = DAILY_HEADER.split(",").length;
  lines.forEach((l, i) => {
    const c = l.split(",").map((x) => x.trim());
    const d = new Date(c[0] + "T00:00:00Z");
    if (c.length !== n || !/^\d{4}-\d{2}-\d{2}$/.test(c[0]) || isNaN(+d) || d.toISOString().slice(0, 10) !== c[0] || c.slice(1).some((x) => x === "" || !Number.isFinite(Number(x))))
      throw new Error(`Line ${i + 2} is not a valid daily row (date, then ${n - 1} numbers).`);
    if (+c[n - 1] > 1 || +c[n - 1] < 0)
      throw new Error(`Line ${i + 2} has occupancy ${(+c[n - 1] * 100).toFixed(1)}% - rooms occupied can't exceed rooms available; check the "Rms/Avl." and occupancy columns in the source report.`);
    byDate.set(c[0], c.join(","));
  });
  if (!lines.length) throw new Error("The file has no daily rows.");
  return [DAILY_HEADER, ...[...byDate].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, l]) => l)].join("\n") + "\n";
}

/** Sales CSV text with the uploaded months set on the year's "Sales" line; every other month and line stays as it is. */
export function mergeSales(existing: string, figures: { year: number; month: number; value: number }[]) {
  const [head = PNL_HEADER, ...lines] = existing.trim() ? existing.trim().split(/\r?\n/) : [];
  const rows = lines.map((l) => l.split(","));
  for (const f of figures) {
    let row = rows.find((c) => +c[0] === f.year && c[1] === "REVENUE" && c[2] === "Sales");
    if (!row) rows.push(row = [String(f.year), "REVENUE", "Sales", ...Array<string>(12).fill("0")]);
    row[3 + f.month] = String(f.value);
  }
  return [head, ...rows.map((c) => c.join(","))].join("\n") + "\n";
}

const db = () => import("@/lib/db"); // lazy so the pure helpers above stay loadable by `node --test` without the Next alias

let imported: Promise<void> | undefined;
/** One-time seed of app.report_files from data/*.csv (rows already in the table win). shortcut: runs once per process; drop it once every environment is migrated. */
function importLegacy() {
  return (imported ??= (async () => {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) return;
    const { q } = await db();
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".csv")))
      await q("INSERT INTO app.report_files(name, body) VALUES($1,$2) ON CONFLICT DO NOTHING", [f, readFileSync(join(dir, f), "utf8")]);
  })().catch((e) => ((imported = undefined), Promise.reject(e))));
}

/** The stored CSV text, or null if that file was never uploaded. */
export async function readFile(name: string) {
  await importLegacy();
  const { q1 } = await db();
  return (await q1<{ body: string }>("SELECT body FROM app.report_files WHERE name=$1", [name]))?.body ?? null;
}
/** Like readFile, but a missing file is an error (editing a cell of a file that does not exist). */
export const needFile = async (name: string) => (await readFile(name)) ?? Promise.reject(new Error("No data on file yet."));

/** Replace a whole CSV in one statement, so a crash never leaves half a file. */
export async function writeCsv(text: string, name: string) {
  const { q } = await db();
  await q("INSERT INTO app.report_files(name, body, updated) VALUES($1,$2,now()) ON CONFLICT(name) DO UPDATE SET body=EXCLUDED.body, updated=now()", [name, text]);
}

// The readers below are synchronous over a snapshot; every page/route that uses them calls `await loadReports()` first, so an upload shows up on the next request.
let snap: Map<string, string> | null = null;
/** Load every report CSV from the database; also back-fills a company's sales grid from a daily report already on file, so nothing uploaded before that grid existed goes missing. */
export async function loadReports() {
  await importLegacy();
  const { q } = await db();
  const m = new Map((await q<{ name: string; body: string }>("SELECT name, body FROM app.report_files")).map((r) => [r.name, r.body]));
  for (const [name, daily] of [...m]) {
    const key = name === "al-manzil-daily.csv" ? AL_MANZIL_KEY : name.match(/^daily-(.+)\.csv$/)?.[1];
    if (!key || m.has(salesPath(key))) continue;
    const yrs = [...new Set(daily.trim().split("\n").slice(1).map((l) => +l.slice(0, 4)))];
    const text = [PNL_HEADER, ...yrs.flatMap((y) => aggregateSales(daily, y))].join("\n") + "\n";
    await writeCsv(text, salesPath(key));
    m.set(salesPath(key), text);
  }
  snap = m;
}
const readCsv = (name: string) => {
  if (!snap) throw new Error("loadReports() must be awaited before reading reports.");
  return snap.get(name)?.trim().split("\n") ?? [];
};

type Kind = "pnl" | "sales" | "units";
type Key = string | string[];
/** key can be one company's key, or several to combine (e.g. "All" real-estate companies). */
const load = (key: Key = AL_MANZIL_KEY, kind: Kind = "pnl") => {
  const keys = Array.isArray(key) ? key : [key];
  return keys.flatMap((k) => readCsv(kind === "sales" ? salesPath(k) : kind === "units" ? unitsPath(k) : pnlPath(k)).slice(1)).map((l) => {
    const [year, main, sub, ...m] = l.split(",");
    return { year: +year, main, sub, m: m.map(Number) };
  });
};
export const years = (key: Key = AL_MANZIL_KEY, kind: Kind = "pnl") => [...new Set(load(key, kind).map((x) => x.year))].sort();
const add = (a: number[], b: number[], s = 1) => a.map((v, i) => v + s * b[i]);
const zero = () => Array<number>(12).fill(0);

export function report(year: number, key: Key = AL_MANZIL_KEY, rows = load(key)) {
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

const locks = new Map<string, Promise<unknown>>();
/** Serializes read-modify-write on one file within this process (shortcut: two server instances can still race - use a row lock if the app is ever scaled out): two requests racing on the same path must not read-before-the-other's-write and silently drop it. */
export function withFileLock<T>(path: string, fn: () => T | Promise<T>): Promise<T> {
  const run = (locks.get(path) ?? Promise.resolve()).then(fn, fn) as Promise<T>;
  locks.set(path, run.catch(() => {}));
  return run;
}

/** CSV text with one figure replaced; throws on a value or month that would corrupt the file. */
export function setCell(csv: string, year: number, main: string, sub: string, month: number, value: number) {
  if (!Number.isFinite(value)) throw new Error("Value must be a number.");
  if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error("Month must be 0-11.");
  return csv.trim().split("\n").map((l, i) => {
    if (!i) return l;
    const cells = l.split(",");
    if (cells[0] !== String(year) || cells[1] !== main || cells[2] !== sub) return l;
    cells[3 + month] = String(Math.round(value * 100) / 100);
    return cells.join(",");
  }).join("\n") + "\n";
}

/** Revenue by account line (room rent, space rental, ...) for one year, non-zero lines only. */
export const revenueLines = (year: number, key: Key = AL_MANZIL_KEY) =>
  load(key).filter((x) => x.year === year && x.main === "REVENUE").map((x) => [x.sub, sum(x.m)] as [string, number]).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);

/** Per month for one year from the daily long/short stay sales report: occupancy %, average daily rate, rooms sold, long/short guests, other revenue. */
export function occupancy(year: number, key: Key = AL_MANZIL_KEY) {
  const days = (Array.isArray(key) ? key : [key]).flatMap((k) => readCsv(dailyPath(k)).slice(1)).map((l) => l.split(",")).filter((c) => c[0].startsWith(`${year}-`));
  return MONTHS.map((_, m) => {
    const d = days.filter((c) => +c[0].slice(5, 7) === m + 1).map((c) => c.slice(1).map(Number));
    const [lg, sg, sold, avail, room, other] = [0, 3, 6, 10, 7, 8].map((i) => sum(d.map((c) => c[i])));
    return { days: d.length, sold, avail, occ: avail ? sold / avail : 0, adr: sold ? room / sold : 0, longShare: sold ? lg / (lg + sg) : 0, room, other };
  });
}

/** Raw daily rows (as in the CSV) for checking: [date, long guests, long rate, long total, short guests, short rate, short total, rooms sold, room revenue, other revenue, ADR, rooms available, occ]. */
export const dailyRows = (key = AL_MANZIL_KEY) => readCsv(dailyPath(key)).slice(1).map((l) => l.split(","));

/** Years actually covered by the daily report - the P&L can have years the stay report doesn't (and vice versa), so the stay report's year picker needs its own list. */
export const dailyYears = (key: Key = AL_MANZIL_KEY) => [...new Set((Array.isArray(key) ? key : [key]).flatMap((k) => readCsv(dailyPath(k)).slice(1)).map((l) => +l.slice(0, 4)))].sort();

/** Detail account rows of one year as they are in the CSV, for the editable table. */
export const plRows = (year: number, key: Key = AL_MANZIL_KEY, kind: Kind = "pnl") => load(key, kind).filter((x) => x.year === year);
