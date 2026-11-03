// Al Manzil P&L (QAR), Jan-Dec, read from data/al-manzil.csv (monthly statements 2024-2025). Costs are positive here.
import { readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export const AL_MANZIL_KEY = "al-manzil";
/** File key for a company's P&L/daily data: Al Manzil keeps its original filenames, every other company is keyed by id. */
export const keyFor = (c: { id: number; name: string }) => (c.name.trim().toLowerCase() === "al manzil" ? AL_MANZIL_KEY : String(c.id));
export const pnlPath = (key: string) => join(process.cwd(), "data", key === AL_MANZIL_KEY ? "al-manzil.csv" : `pl-${key}.csv`);
export const dailyPath = (key: string) => join(process.cwd(), "data", key === AL_MANZIL_KEY ? "al-manzil-daily.csv" : `daily-${key}.csv`);
/** Monthly sales totals, P&L-shaped (year,main,sub,Jan..Dec) - edited directly, same as the P&L grid. The daily file stays the source for occupancy/ADR elsewhere. */
export const salesPath = (key: string) => join(process.cwd(), "data", key === AL_MANZIL_KEY ? "al-manzil-sales.csv" : `sales-${key}.csv`);
export const PNL_HEADER = "year,main,sub," + MONTHS.join(",");
export const DAILY_HEADER = "date,long_guests,long_rate,long_total,short_guests,short_rate,short_total,rooms_occupied,room_revenue,other_revenue,avg_rate,rooms_available,occ";

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
    byDate.set(c[0], c.join(","));
  });
  if (!lines.length) throw new Error("The file has no daily rows.");
  return [DAILY_HEADER, ...[...byDate].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, l]) => l)].join("\n") + "\n";
}

export const CSV = pnlPath(AL_MANZIL_KEY);
// Re-read on every call so an uploaded statement shows up without a restart. No upload yet reads as empty.
const readCsv = (path: string) => { try { return readFileSync(path, "utf8").trim().split("\n"); } catch { return []; } };

/** First read of a company's sales grid: back-fill it from any daily report already on file, so nothing uploaded before this grid existed goes missing. */
function ensureSalesFile(key: string) {
  const path = salesPath(key);
  try { readFileSync(path); return; } catch { /* not created yet */ }
  let daily: string;
  try { daily = readFileSync(dailyPath(key), "utf8"); } catch { return; } // nothing to back-fill
  const yrs = [...new Set(daily.trim().split("\n").slice(1).map((l) => +l.slice(0, 4)))];
  writeCsv([PNL_HEADER, ...yrs.flatMap((y) => aggregateSales(daily, y))].join("\n") + "\n", path);
}

const load = (key = AL_MANZIL_KEY, kind: "pnl" | "sales" = "pnl") => {
  if (kind === "sales") ensureSalesFile(key);
  return readCsv(kind === "sales" ? salesPath(key) : pnlPath(key)).slice(1).map((l) => {
    const [year, main, sub, ...m] = l.split(",");
    return { year: +year, main, sub, m: m.map(Number) };
  });
};
export const years = (key = AL_MANZIL_KEY, kind: "pnl" | "sales" = "pnl") => [...new Set(load(key, kind).map((x) => x.year))].sort();
const add = (a: number[], b: number[], s = 1) => a.map((v, i) => v + s * b[i]);
const zero = () => Array<number>(12).fill(0);

export function report(year: number, key = AL_MANZIL_KEY, rows = load(key)) {
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

/** Write a whole CSV via a temp file so a crash never leaves half a file. */
export function writeCsv(text: string, path = CSV) {
  writeFileSync(path + ".tmp", text);
  renameSync(path + ".tmp", path);
}

const locks = new Map<string, Promise<unknown>>();
/** Serializes read-modify-write on one file: two requests racing on the same path must not read-before-the-other's-write and silently drop it. */
export function withFileLock<T>(path: string, fn: () => T): Promise<T> {
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
export const revenueLines = (year: number, key = AL_MANZIL_KEY) =>
  load(key).filter((x) => x.year === year && x.main === "REVENUE").map((x) => [x.sub, sum(x.m)] as [string, number]).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);

/** Per month for one year from the daily long/short stay sales report: occupancy %, average daily rate, rooms sold, long/short guests, other revenue. */
export function occupancy(year: number, key = AL_MANZIL_KEY) {
  const days = readCsv(dailyPath(key)).slice(1).map((l) => l.split(",")).filter((c) => c[0].startsWith(`${year}-`));
  return MONTHS.map((_, m) => {
    const d = days.filter((c) => +c[0].slice(5, 7) === m + 1).map((c) => c.slice(1).map(Number));
    const [lg, sg, sold, avail, room, other] = [0, 3, 6, 10, 7, 8].map((i) => sum(d.map((c) => c[i])));
    return { days: d.length, sold, occ: avail ? sold / avail : 0, adr: sold ? room / sold : 0, longShare: sold ? lg / (lg + sg) : 0, room, other };
  });
}

/** Raw daily rows (as in the CSV) for checking: [date, long guests, long rate, long total, short guests, short rate, short total, rooms sold, room revenue, other revenue, ADR, rooms available, occ]. */
export const dailyRows = (key = AL_MANZIL_KEY) => readCsv(dailyPath(key)).slice(1).map((l) => l.split(","));

/** Detail account rows of one year as they are in the CSV, for the editable table. */
export const plRows = (year: number, key = AL_MANZIL_KEY, kind: "pnl" | "sales" = "pnl") => load(key, kind).filter((x) => x.year === year);
