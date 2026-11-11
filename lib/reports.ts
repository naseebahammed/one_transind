// Company report figures read from app.company_figures and app.daily_sales, and the totals worked out from them: P&L, occupancy, average daily rate.
// Revenue is positive, costs negative, amounts in QAR. Occupancy and rates are calculated here on demand, never stored.
import { cache } from "react";
import type { DailyRow } from "./report-parsers.ts";
import { MONTHS, sum } from "./format.ts";
import { SECTOR } from "./org.ts";

/** A company's key in the readers below. */
export const keyFor = (c: { id: number }) => String(c.id);

// Lowercase company name the Al Manzil panels look for (see the shortcut note in loadReports).
export const AL_MANZIL_NAME = "al manzil";

const db = () => import("@/lib/db"); // lazy so this file stays loadable by `node --test` without the Next alias

export type ReportRow = { year: number; main: string; sub: string; m: number[]; sign?: 1 | -1 };
type Day = Omit<DailyRow, "date"> & { date: string };
type Kind = "pnl" | "sales" | "units";
type Key = string | string[];
export type Reports = { rows: Map<string, ReportRow[]>; daily: Map<string, Day[]>; alManzil: string };

type QueryRunner = <T>(text: string, params?: unknown[]) => Promise<T[]>;

async function buildReports(query?: QueryRunner): Promise<Reports> {
  const q: QueryRunner = query ?? (await db()).q;
  const NUMS = "long_guests,long_rate,long_total,short_guests,short_rate,short_total,rooms_occupied,room_revenue,other_revenue,rooms_available";
  const [figures, derived, days, co] = await Promise.all([
    q<{ id: number; section: Kind; y: number; mo: number; main: string; line: string; unit_type: string; v: number; sign?: 1 | -1 }>(
      `SELECT f.company_id AS id, f.section, EXTRACT(year FROM f.period)::int AS y, EXTRACT(month FROM f.period)::int - 1 AS mo, f.main, f.line, f.unit_type, f.value::float8 AS v, a.normal_sign AS sign
       FROM app.company_figures f JOIN app.accounts a ON a.section=f.section AND a.main=f.main AND a.sub=f.line
       WHERE f.section IN ('pnl','sales','units') ORDER BY a.main_order, a.id`),
    q<{ id: number; y: number; mo: number; main: string; line: string; v: number }>(
      // A retail company's monthly sales come from its daily takings. figure-rules.ts refuses a monthly figure for a month that has takings, and the reverse, so they cannot add on top.
      `SELECT company_id AS id, EXTRACT(year FROM period)::int AS y, EXTRACT(month FROM period)::int - 1 AS mo, main, line, value::float8 AS v
       FROM (SELECT company_id, period, main, line, value FROM app.daily_sales_monthly
             UNION ALL SELECT r.company_id, date_trunc('month', r.date)::date AS period, 'REVENUE', 'Sales' AS line, SUM(r.value) AS value
             FROM app.daily_receipts r JOIN app.companies c ON c.id = r.company_id
             WHERE r.line <> 'Bank deposits' AND c.sector = $1 GROUP BY 1, 2) monthly
       ORDER BY array_position(ARRAY['Long stay','Short stay','Room revenue','Other revenue','Occupied','Available'], line)`,
      [SECTOR.retail],
    ),
    q<Day & { id: number }>(`SELECT company_id AS id, to_char(date,'YYYY-MM-DD') AS date, ${NUMS.split(",").map((c) => `${c}::float8 AS ${c}`).join(",")} FROM app.daily_sales ORDER BY date`),
    // shortcut: the Al Manzil panels on /finance, /admin/finance and Ask find it by name; give them a company picker to drop this.
    q<{ id: number }>(
      `SELECT id FROM app.companies WHERE lower(name) LIKE $1 ESCAPE '\\' AND active = 1 AND hidden = 0 ORDER BY id LIMIT 1`,
      [`${AL_MANZIL_NAME}%`],
    ),
  ]);
  const rows = new Map<string, ReportRow[]>(), index = new Map<string, ReportRow>();
  const put = (id: number, kind: Kind, y: number, main: string, sub: string, mo: number, v: number, sign?: 1 | -1) => {
    const k = `${id}|${kind}|${y}|${main}|${sub}`;
    let r = index.get(k);
    if (!r) {
      index.set(k, r = { year: y, main, sub, m: Array<number>(12).fill(0), ...(sign !== undefined && { sign }) });
      const list = `${id}|${kind}`;
      rows.set(list, [...(rows.get(list) ?? []), r]);
    }
    r.m[mo] += v; // a company with branches has one row per branch: the company figure is their sum
  };
  for (const f of figures) put(f.id, f.section, f.y, f.section === "units" ? f.unit_type : f.main, f.line, f.mo, f.v, f.sign);
  for (const d of derived) put(d.id, "sales", d.y, d.main, d.line, d.mo, d.v);
  const daily = new Map<string, Day[]>();
  for (const { id, ...d } of days) daily.set(String(id), [...(daily.get(String(id)) ?? []), d]);
  return { rows, daily, alManzil: co[0] ? String(co[0].id) : "" };
}

const loadCached = cache(() => buildReports());

/** Load every company's figures from the database (cached per request). `query` is only passed by tests, to run without a database. */
export const loadReports = (query?: QueryRunner) => (query ? buildReports(query) : loadCached());

/** Key of the company the Al Manzil panels show. */
export const alManzilKey = (reports: Reports) => reports.alManzil;

const load = (reports: Reports, key: Key, kind: Kind = "pnl") => (Array.isArray(key) ? key : [key]).flatMap((k) => reports.rows.get(`${k}|${kind}`) ?? []);
const daysOf = (reports: Reports, key: Key) => (Array.isArray(key) ? key : [key]).flatMap((k) => reports.daily.get(k) ?? []);
export const years = (reports: Reports, key: Key, kind: Kind = "pnl") => [...new Set(load(reports, key, kind).map((x) => x.year))].sort();
const add = (a: number[], b: number[], s = 1) => a.map((v, i) => v + s * b[i]);
const zero = () => Array<number>(12).fill(0);

const isRevenue = (x: ReportRow) => (x.sign ?? (x.main === "REVENUE" ? 1 : -1)) > 0;

export function report(reports: Reports, year: number, key: Key, rows = load(reports, key)) {
  const r = rows.filter((x) => x.year === year);
  const by = new Map<string, number[]>();
  for (const x of r) if (!isRevenue(x)) by.set(x.main, add(by.get(x.main) ?? zero(), x.m, -1));
  const costGroups = [...by].filter(([, v]) => sum(v) !== 0).map(([k, v]) => [label[k] ?? k, v] as [string, number[]]);
  const revenue = r.filter(isRevenue).reduce((a, x) => add(a, x.m), zero());
  const totalCost = costGroups.reduce((a, [, v]) => add(a, v), zero());
  const roomRent = r.filter((x) => x.sub === "Room Rent").reduce((a, x) => add(a, x.m), zero());
  return { revenue, roomRent, totalCost, net: add(revenue, totalCost, -1), costGroups };
}

const label: Record<string, string> = {
  "FINANCE COST": "Finance cost", "DEPRECIATION PPE": "Depreciation", "STAFF COST": "Staff cost", "REPAIR AND MAINTENANCE EXP": "Repair & maintenance",
  "UTILITY EXPENSES": "Utilities", "CLEANING EXP": "Cleaning", "COMPUTER & STATIONERY": "Computer & stationery", "INSURANCE EXP": "Insurance",
  "MISCELLANEOUS": "Miscellaneous", "MARKETING & ADVERTISING": "Marketing", "VEHICLE EXPENSES": "Vehicle", "LEGAL AND PROFESSIONAL EXP": "Legal & professional",
};

/** Revenue by account line (room rent, space rental, ...) for one year, non-zero lines only. */
export function revenueLines(reports: Reports, year: number, key: Key) {
  const by = new Map<string, number>();
  for (const x of load(reports, key)) if (x.year === year && isRevenue(x)) by.set(x.sub, (by.get(x.sub) ?? 0) + sum(x.m));
  return [...by].filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
}

/** Per month for one year from the daily long/short stay sales report: occupancy %, average daily rate, rooms sold, long/short guests, other revenue. */
export function occupancy(reports: Reports, year: number, key: Key) {
  const days = daysOf(reports, key).filter((d) => d.date.startsWith(`${year}-`));
  return MONTHS.map((_, m) => {
    const d = days.filter((x) => +x.date.slice(5, 7) === m + 1);
    const total = (k: keyof Omit<Day, "date">) => sum(d.map((x) => x[k]));
    const lg = total("long_guests"), sg = total("short_guests"), sold = total("rooms_occupied"), avail = total("rooms_available"), room = total("room_revenue"), other = total("other_revenue");
    return { days: d.length, sold, avail, occ: avail ? sold / avail : 0, adr: sold ? room / sold : 0, longShare: lg + sg ? lg / (lg + sg) : 0, room, other };
  });
}

/** Years actually covered by the daily report - the P&L can have years the stay report doesn't (and vice versa), so the stay report's year picker needs its own list. */
export const dailyYears = (reports: Reports, key: Key) => [...new Set(daysOf(reports, key).map((d) => +d.date.slice(0, 4)))].sort();

/** Detail account rows of one year, for the monthly grids. */
export const plRows = (reports: Reports, year: number, key: Key, kind: Kind = "pnl") => load(reports, key, kind).filter((x) => x.year === year);
