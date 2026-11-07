// Company report figures read from app.company_figures and app.daily_sales, and the totals worked out from them: P&L, occupancy, average daily rate.
// Revenue is positive, costs negative, amounts in QAR. Occupancy and rates are calculated here on demand, never stored.
import type { DailyRow } from "./report-parsers.ts";
import { MONTHS, sum } from "./format.ts";

/** A company's key in the readers below. */
export const keyFor = (c: { id: number }) => String(c.id);

// Lowercase company name the Al Manzil panels look for (see the shortcut note in loadReports).
export const AL_MANZIL_NAME = "al manzil";

const db = () => import("@/lib/db"); // lazy so this file stays loadable by `node --test` without the Next alias

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
