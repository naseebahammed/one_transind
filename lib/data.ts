import { cacheLife } from "next/cache";
import { cleanText } from "@/lib/input-validation";
import { getPeriod } from "@/lib/period";
import { pg } from "@/lib/pg";
import { salesTable } from "@/lib/server-config";

// Sales value = IN-DTS and IN-OT invoices plus CR credit notes (already negative), from app.sales_clean: de-duplicated, without tax (migration 023). Data starts 2026-08-09.
// Validated via salesTable() so only strict identifier syntax (schema.table or table) can ever be interpolated; trailing "s" is the table alias.
const salesSource = () => `${salesTable()} s`;
const clampMonth = (month: number) => (Number.isInteger(month) && month >= 0 && month <= 11 ? month : 0);
const TOP_ITEMS = 25;
const TOP_CUSTOMERS = 60;

// Date-range filters instead of to_char/EXTRACT on the column, so an index on DOC_DATE can be used. p is a "YYYY-MM-01" date parameter.
// `days` keeps only the first N days of the month, so the month still running is compared with the same days of other months (31 = the whole month).
const inMonth = (col: string, p: string, days = 31) => `(${col} >= ${p}::date AND ${col} < LEAST((${p}::date + interval '1 month')::date, ${p}::date + ${days}))`;
const inMonths = (col: string, days: number, ...ps: string[]) => "(" + ps.map((p) => inMonth(col, p, days)).join(" OR ") + ")";
// January to month m (1-12) of year y; the last month only up to `days`.
const inYtd = (col: string, y: string, m: string, days = 31) => `(${col} >= make_date((${y})::int,1,1) AND ${col} < LEAST((make_date((${y})::int,(${m})::int,1) + interval '1 month')::date, make_date((${y})::int,(${m})::int,1) + ${days}))`;
// Days of the selected month to count: the month still running is cut at the latest data day, any other month is whole.
const daysOf = (period: { month: number; day: number }, month: number) => (month === period.month ? period.day : 31);

export type Item = { name: string; value: number; lastMonth: number; units: number };
export type Brand = { name: string; value: number; lastMonth: number; items: Item[] };
type Hist = { year: number; month: number; value: number; cost: number; creditNotes: number };
type Cust = { id: string; name: string; category: string; group: string; months: number[]; ytd: number; mtd: number; lastMonth: number; brands: { name: string; value: number; lastMonth: number }[] };

/** Sales and cost per year and month, all history (full months; only the month still running is partial). */
async function getHistory(): Promise<Hist[]> {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const { rows } = await pg.query<Hist>(
    `SELECT EXTRACT(year FROM "DOC_DATE")::int AS year, EXTRACT(month FROM "DOC_DATE")::int AS month,
            SUM("NET_AMOUNT")::float8 AS value, SUM("NET_COST")::float8 AS cost,
            COALESCE(SUM("NET_AMOUNT") FILTER (WHERE "DOC_TYPE" = 'CR'), 0)::float8 AS "creditNotes"
     FROM ${table} GROUP BY 1,2 ORDER BY 1,2`);
  return rows;
}

/** The latest month (up to the latest data day) plus the current year's monthly totals; `beforeToDate` is the month before it over the same days. */
export async function getOverview() {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const { year, month, day, before } = await getPeriod(table);
  const { rows } = await pg.query<Hist>(
    `SELECT EXTRACT(year FROM "DOC_DATE")::int AS year, EXTRACT(month FROM "DOC_DATE")::int AS month,
            SUM("NET_AMOUNT")::float8 AS value, SUM("NET_COST")::float8 AS cost,
            COALESCE(SUM("NET_AMOUNT") FILTER (WHERE "DOC_TYPE" = 'CR'), 0)::float8 AS "creditNotes"
     FROM ${table} WHERE ${inYtd('"DOC_DATE"', "$1", "$2")} GROUP BY 1,2 ORDER BY 1,2`, [year, month + 1]);
  const months = Array.from({ length: month + 1 }, (_, i) => rows.find((h) => h.month === i + 1) ?? { year: year, month: i + 1, value: 0, cost: 0, creditNotes: 0 });
  const { rows: [prev] } = await pg.query<{ v: number | null }>(
    `SELECT SUM("NET_AMOUNT")::float8 AS v FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1", day)}`, [`${before}-01`]);
  return { year, month, day, months, beforeToDate: prev?.v ?? 0 };
}

/** Brands and their top items for the latest month (up to the latest data day) and the same days of the month before. */
export async function getOverviewBrands() {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const { cur, before, day } = await getPeriod(table);
  const curStart = `${cur}-01`, beforeStart = `${before}-01`;
  const { rows } = await pg.query<{ k: string; b: string; i: string; v: number; u: number }>(
    `SELECT (CASE WHEN "DOC_DATE" >= $1::date THEN $1 ELSE $2 END)::text AS k, COALESCE("BRAND",'-') AS b, COALESCE("ITEM_NAME",'-') AS i,
            SUM("NET_AMOUNT")::float8 AS v, COALESCE(SUM("QTY_PCS"),0)::float8 AS u FROM ${table}
     WHERE ${inMonths('"DOC_DATE"', day, "$1", "$2")} GROUP BY 1,2,3`, [curStart, beforeStart]);
  const brands = new Map<string, { name: string; value: number; lastMonth: number; items: Map<string, Item> }>();
  for (const r of rows) {
    const b = brands.get(r.b) ?? { name: r.b, value: 0, lastMonth: 0, items: new Map() };
    const it = b.items.get(r.i) ?? { name: r.i, value: 0, lastMonth: 0, units: 0 };
    if (r.k === curStart) { b.value += r.v; it.value += r.v; it.units += r.u; } else { b.lastMonth += r.v; it.lastMonth += r.v; }
    b.items.set(r.i, it); brands.set(r.b, b);
  }
  const tree: Brand[] = [...brands.values()].filter((b) => b.value || b.lastMonth).map((b) => {
    const items = [...b.items.values()].filter((x) => x.value || x.lastMonth).sort((a, c) => c.value - a.value);
    const top = items.slice(0, TOP_ITEMS), rest = items.slice(TOP_ITEMS);
    if (rest.length) top.push({ name: `Other (${rest.length} items)`, value: rest.reduce((a, x) => a + x.value, 0), lastMonth: rest.reduce((a, x) => a + x.lastMonth, 0), units: rest.reduce((a, x) => a + x.units, 0) });
    return { name: b.name, value: b.value, lastMonth: b.lastMonth, items: top };
  }).sort((a, c) => c.value - a.value);

  return tree;
}

/** Top customers by year-to-date sales, with monthly series and brand split for the latest month (up to the latest data day). */
export async function getCustomers() {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const { year, month, day, cur, before } = await getPeriod(table);
  const curStart = `${cur}-01`, beforeStart = `${before}-01`;
  // vd = the month's first `day` days, so last month is compared over the same days as this month.
  const { rows } = await pg.query<{ id: string; name: string; cat: string; grp: string; m: number; v: number; vd: number }>(
    `SELECT "CUST_NO" AS id, MAX("CUST_NAME") AS name, MAX("CUST_CATEGORY") AS cat, MAX("GROUP_NAME") AS grp,
            EXTRACT(month FROM "DOC_DATE")::int AS m, SUM("NET_AMOUNT")::float8 AS v,
            COALESCE(SUM("NET_AMOUNT") FILTER (WHERE EXTRACT(day FROM "DOC_DATE") <= $3), 0)::float8 AS vd
     FROM ${table} WHERE ${inYtd('"DOC_DATE"', "$1", "$2")} GROUP BY 1,5`, [year, month + 1, day]);
  const byId = new Map<string, Cust>();
  for (const r of rows) {
    const c = byId.get(r.id) ?? { id: r.id, name: r.name ?? r.id, category: r.cat ?? "", group: r.grp ?? "", months: Array(month + 1).fill(0), ytd: 0, mtd: 0, lastMonth: 0, brands: [] };
    c.months[r.m - 1] = r.v; c.ytd += r.v;
    if (r.m - 1 === month) c.mtd = r.v;
    if (r.m - 1 === month - 1) c.lastMonth = r.vd;
    byId.set(r.id, c);
  }
  const top = [...byId.values()].sort((a, b) => b.ytd - a.ytd).slice(0, TOP_CUSTOMERS);
  const { rows: br } = await pg.query<{ id: string; k: string; b: string; v: number }>(
    `SELECT "CUST_NO" AS id, (CASE WHEN "DOC_DATE" >= $2::date THEN $2 ELSE $3 END)::text AS k, COALESCE("BRAND",'-') AS b, SUM("NET_AMOUNT")::float8 AS v
     FROM ${table} WHERE "CUST_NO" = ANY($1) AND ${inMonths('"DOC_DATE"', day, "$2", "$3")} GROUP BY 1,2,3`, [top.map((c) => c.id), curStart, beforeStart]);
  const idx = new Map(top.map((c) => [c.id, c]));
  const tmp = new Map<string, Map<string, { name: string; value: number; lastMonth: number }>>();
  for (const r of br) {
    const m = tmp.get(r.id) ?? new Map<string, { name: string; value: number; lastMonth: number }>();
    const b = m.get(r.b) ?? { name: r.b, value: 0, lastMonth: 0 };
    if (r.k === curStart) b.value += r.v;
    else { b.lastMonth += r.v; if (month === 0) idx.get(r.id)!.lastMonth += r.v; }
    m.set(r.b, b); tmp.set(r.id, m);
  }
  for (const [id, m] of tmp) idx.get(id)!.brands = [...m.values()].filter((b) => b.value || b.lastMonth).sort((a, b) => b.value - a.value);
  return { year, month, customers: top, customerCount: byId.size };
}

const DIMENSIONS = {
  dept: { label: "Department", sql: `COALESCE(d.department_name, s."DEPT_CODE", '-')`, join: `LEFT JOIN public.invs_departments d ON d.department_code = s."DEPT_CODE"` },
  brand: { label: "Brand", sql: `COALESCE(s."BRAND", '-')`, join: "" },
  supplier: { label: "Supplier", sql: `COALESCE(s."SUPPLIER_NAME", '-')`, join: "" },
  category: { label: "Customer category", sql: `COALESCE(s."CUST_CATEGORY", '-')`, join: "" },
  group: { label: "Customer group", sql: `COALESCE(s."GROUP_NAME", '-')`, join: "" },
  salesman: { label: "Salesman", sql: `COALESCE(s."SMAN_NAME", '-')`, join: "" },
} as const;
type Dim = keyof typeof DIMENSIONS;
export type Row = { key: string; value: number; cost: number; creditNotes: number; lastMonth: number };

const ymOf = (y: number, m: number) => `${y + Math.floor(m / 12)}-${String((((m % 12) + 12) % 12) + 1).padStart(2, "0")}-01`;

/** One month of sales split by a dimension, with cost, credit notes and the previous month's sales. */
export async function getBreakdown(month: number, by: Dim) {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const safeMonth = clampMonth(month);
  const period = await getPeriod(table), { year } = period, days = daysOf(period, safeMonth);
  const cur = ymOf(year, safeMonth), before = ymOf(year, safeMonth - 1), d = DIMENSIONS[by];
  const [{ rows }, { rows: [n] }] = await Promise.all([
    pg.query<{ k: string; ym: string; v: number; c: number; cr: number }>(
      `SELECT ${d.sql} AS k, (CASE WHEN s."DOC_DATE" >= $1::date THEN $1 ELSE $2 END)::text AS ym, SUM(s."NET_AMOUNT")::float8 AS v, SUM(s."NET_COST")::float8 AS c,
              COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE s."DOC_TYPE" = 'CR'), 0)::float8 AS cr
       FROM ${table} ${d.join} WHERE ${inMonths('s."DOC_DATE"', days, "$1", "$2")} GROUP BY 1,2`, [cur, before]),
    pg.query<{ customers: number; items: number }>(
      `SELECT COUNT(DISTINCT "CUST_NO")::int AS customers, COUNT(DISTINCT "ITEM_CODE")::int AS items FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1", days)}`, [cur]),
  ]);
  const map = new Map<string, Row>();
  for (const r of rows) {
    const x = map.get(r.k) ?? { key: r.k, value: 0, cost: 0, creditNotes: 0, lastMonth: 0 };
    if (r.ym === cur) { x.value = r.v; x.cost = r.c; x.creditNotes = r.cr; } else x.lastMonth = r.v;
    map.set(r.k, x);
  }
  return { year, rows: [...map.values()].filter((r) => r.value || r.lastMonth).sort((a, b) => b.value - a.value), customers: n.customers, items: n.items };
}

/** Delivery routes and drivers for one month, from the sales documents (no fleet or warehouse source exists). */
export async function getRoutes(month: number) {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const safeMonth = clampMonth(month);
  const period = await getPeriod(table), { year } = period, days = daysOf(period, safeMonth);
  const cur = ymOf(year, safeMonth), before = ymOf(year, safeMonth - 1);
  const [{ rows: routes }, { rows: drivers }] = await Promise.all([
    pg.query<{ k: string; ym: string; v: number; drivers: number; docs: number }>(
      `SELECT COALESCE("ROUTE_DESC",'-') AS k, (CASE WHEN "DOC_DATE" >= $1::date THEN $1 ELSE $2 END)::text AS ym, SUM("NET_AMOUNT")::float8 AS v,
              COUNT(DISTINCT "DRIVER_NAME")::int AS drivers, COUNT(DISTINCT "DOC_NO")::int AS docs
       FROM ${table} WHERE ${inMonths('"DOC_DATE"', days, "$1", "$2")} GROUP BY 1,2`, [cur, before]),
    pg.query<{ name: string; value: number; customers: number; docs: number }>(
      `SELECT "DRIVER_NAME" AS name, SUM("NET_AMOUNT")::float8 AS value, COUNT(DISTINCT "CUST_NO")::int AS customers, COUNT(DISTINCT "DOC_NO")::int AS docs
       FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1", days)} AND "DRIVER_NAME" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, [cur]),
  ]);
  const map = new Map<string, { key: string; value: number; lastMonth: number; drivers: number; docs: number }>();
  for (const r of routes) {
    const x = map.get(r.k) ?? { key: r.k, value: 0, lastMonth: 0, drivers: 0, docs: 0 };
    if (r.ym === cur) { x.value = r.v; x.drivers = r.drivers; x.docs = r.docs; } else x.lastMonth = r.v;
    map.set(r.k, x);
  }
  return { year, routes: [...map.values()].filter((r) => r.value || r.lastMonth).sort((a, b) => b.value - a.value), drivers };
}

export type DrillRow = { key: string; label: string; sub: string; value: number; lastMonth: number; lastYear: number; twoYearsAgo: number; cost: number; units: number };
const LEVELS = {
  p: [
    { key: `COALESCE(s."DEPT_CODE",'-')`, label: `MAX(COALESCE(d.department_name, s."DEPT_CODE", '-'))`, sub: `COUNT(DISTINCT s."ITEM_CODE") FILTER (WHERE cur) || ' items · ' || COUNT(DISTINCT s."CUST_NO") FILTER (WHERE cur) || ' customers'` },
    { key: `COALESCE(s."BRAND",'-')`, label: `MAX(COALESCE(s."BRAND",'-'))`, sub: `COUNT(DISTINCT s."ITEM_CODE") FILTER (WHERE cur) || ' items · ' || COUNT(DISTINCT s."CUST_NO") FILTER (WHERE cur) || ' customers'` },
    { key: `COALESCE(s."ITEM_CODE",'-')`, label: `MAX(COALESCE(s."ITEM_NAME",'-'))`, sub: `MAX(s."ITEM_CODE")` },
  ],
  c: [
    { key: `COALESCE(s."GROUP_NAME",'-')`, label: `MAX(COALESCE(s."GROUP_NAME",'-'))`, sub: `COUNT(DISTINCT s."CUST_NO") FILTER (WHERE cur) || ' branches'` },
    { key: `COALESCE(s."CUST_NO",'-')`, label: `MAX(COALESCE(s."CUST_NAME",'-'))`, sub: `MAX(s."CUST_NO")` },
    { key: `COALESCE(s."BRAND",'-')`, label: `MAX(COALESCE(s."BRAND",'-'))`, sub: `COUNT(DISTINCT s."ITEM_CODE") FILTER (WHERE cur) || ' items'` },
    { key: `COALESCE(s."ITEM_CODE",'-')`, label: `MAX(COALESCE(s."ITEM_NAME",'-'))`, sub: `MAX(s."ITEM_CODE")` },
  ],
} as const;

/** One level of a drill-down for a month: p = department > brand > item, c = customer group > customer > brand > item. */
export async function getDrill(month: number, kind: "p" | "c", path: string[], dept = "") {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const safeMonth = clampMonth(month);
  const safeDept = cleanText(dept, 40);
  const period = await getPeriod(table), { year } = period, days = daysOf(period, safeMonth);
  const ym = [ymOf(year, safeMonth), ymOf(year, safeMonth - 1), ymOf(year - 1, safeMonth), ymOf(year - 2, safeMonth)];
  if (path.length >= LEVELS[kind].length) return []; // a path as deep as the leaf level (or deeper, e.g. from a hand-edited URL) has no children
  const level = LEVELS[kind][path.length];
  const params: string[] = [...ym];
  const where = path.map((p, i) => { params.push(cleanText(p, 120)); return `${LEVELS[kind][i].key}::text = $${params.length}`; });
  if (safeDept && kind === "p" && !path.length) { params.push(safeDept); where.push(`COALESCE(s."DEPT_CODE",'-')::text = $${params.length}`); }
  const curSql = inMonth('s."DOC_DATE"', "$1", days);
  const sql = level.sub.replaceAll("cur", curSql);
  const join = kind === "p" && !path.length ? `LEFT JOIN public.invs_departments d ON d.department_code = s."DEPT_CODE"` : "";
  const { rows } = await pg.query<DrillRow>(
    `SELECT ${level.key} AS key, ${level.label} AS label, ${sql} AS sub,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${curSql}),0)::float8 AS value,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${inMonth('s."DOC_DATE"', "$2", days)}),0)::float8 AS "lastMonth",
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${inMonth('s."DOC_DATE"', "$3", days)}),0)::float8 AS "lastYear",
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${inMonth('s."DOC_DATE"', "$4", days)}),0)::float8 AS "twoYearsAgo",
            COALESCE(SUM(s."NET_COST") FILTER (WHERE ${curSql}),0)::float8 AS cost,
            COALESCE(SUM(s."QTY_PCS") FILTER (WHERE ${curSql}),0)::float8 AS units
     FROM ${table} ${join}
     WHERE ${inMonths('s."DOC_DATE"', days, "$1", "$2", "$3", "$4")}${where.length ? " AND " + where.join(" AND ") : ""}
     GROUP BY 1 ORDER BY value DESC`, params);
  return rows.filter((r) => r.value || r.lastMonth || r.lastYear || r.twoYearsAgo || r.cost);
}

async function getDrillLabel(kind: "p" | "c", depth: number, rawKey: string): Promise<string> {
  "use cache";
  cacheLife("hours");
  const safeKey = cleanText(rawKey, 120);
  if (!safeKey || safeKey === "-") return safeKey || "-";
  if (kind === "p" && depth === 0) {
    const { rows: [row] } = await pg.query<{ label: string }>(
      `SELECT department_name AS label FROM public.invs_departments WHERE department_code = $1 LIMIT 1`,
      [safeKey],
    );
    return row?.label || safeKey;
  }
  if (kind === "c" && depth === 1) {
    const table = salesSource();
    const { rows: [row] } = await pg.query<{ label: string }>(
      `SELECT "CUST_NAME" AS label FROM ${table} WHERE "CUST_NO" = $1 AND "CUST_NAME" IS NOT NULL LIMIT 1`,
      [safeKey],
    );
    return row?.label || safeKey;
  }
  if ((kind === "p" && depth === 2) || (kind === "c" && depth === 3)) {
    const table = salesSource();
    const { rows: [row] } = await pg.query<{ label: string }>(
      `SELECT "ITEM_NAME" AS label FROM ${table} WHERE "ITEM_CODE" = $1 AND "ITEM_NAME" IS NOT NULL LIMIT 1`,
      [safeKey],
    );
    return row?.label || safeKey;
  }
  return safeKey;
}

/** Label of each node along a drill path, for breadcrumbs. */
export async function getDrillLabels(_month: number, kind: "p" | "c", path: string[]) {
  return Promise.all(path.map((k, i) => getDrillLabel(kind, i, k)));
}

/** Monthly sales per year (all years), optionally for one department. */
export async function getMonthly(dept = "") {
  "use cache";
  cacheLife("hours");
  const safeDept = cleanText(dept, 40);
  if (!safeDept) return (await getHistory()).map(({ year, month, value }) => ({ year, month, value }));
  const table = salesSource();
  const { rows } = await pg.query<{ year: number; month: number; value: number }>(
    `SELECT EXTRACT(year FROM "DOC_DATE")::int AS year, EXTRACT(month FROM "DOC_DATE")::int AS month, SUM("NET_AMOUNT")::float8 AS value
     FROM ${table} WHERE COALESCE("DEPT_CODE",'-') = $1 GROUP BY 1,2 ORDER BY 1,2`, [safeDept]);
  return rows;
}

/** Department list with year-to-date sales, cost and previous-year YTD up to the same day of the latest month. */
export async function getSectors() {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const { year, month, day } = await getPeriod(table);
  const thisYear = `s."DOC_DATE" >= make_date(($1)::int,1,1)`;
  const { rows } = await pg.query<{ key: string; label: string; value: number; cost: number; lastYear: number }>(
    `SELECT COALESCE(s."DEPT_CODE",'-') AS key, MAX(COALESCE(d.department_name, s."DEPT_CODE", '-')) AS label,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${thisYear}),0)::float8 AS value,
            COALESCE(SUM(s."NET_COST") FILTER (WHERE ${thisYear}),0)::float8 AS cost,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE NOT (${thisYear})),0)::float8 AS "lastYear"
     FROM ${table} LEFT JOIN public.invs_departments d ON d.department_code = s."DEPT_CODE"
     WHERE (${inYtd('s."DOC_DATE"', "$2", "$3", day)} OR ${inYtd('s."DOC_DATE"', "$2 - 1", "$3", day)}) GROUP BY 1 ORDER BY value DESC`, [year, year, month + 1]);
  return rows.filter((r) => r.value || r.lastYear);
}

/** Per group or brand: sales, cost, items and customers for one month. */
export async function getStats(month: number, by: "group" | "brand") {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const safeMonth = clampMonth(month);
  const period = await getPeriod(table), { year } = period;
  const col = by === "group" ? `COALESCE("GROUP_NAME",'-')` : `COALESCE("BRAND",'-')`;
  const { rows } = await pg.query<{ key: string; value: number; cost: number; items: number; customers: number }>(
    `SELECT ${col} AS key, SUM("NET_AMOUNT")::float8 AS value, SUM("NET_COST")::float8 AS cost,
            COUNT(DISTINCT "ITEM_CODE")::int AS items, COUNT(DISTINCT "CUST_NO")::int AS customers
     FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1", daysOf(period, safeMonth))} GROUP BY 1 ORDER BY value DESC`, [ymOf(year, safeMonth)]);
  return rows;
}

/** Salesmen with sales for one month. */
export async function getSalesmen(month: number) {
  "use cache";
  cacheLife("hours");
  const table = salesSource();
  const safeMonth = clampMonth(month);
  const period = await getPeriod(table), { year } = period;
  const { rows } = await pg.query<{ name: string; value: number; customers: number; docs: number }>(
    `SELECT "SMAN_NAME" AS name, SUM("NET_AMOUNT")::float8 AS value, COUNT(DISTINCT "CUST_NO")::int AS customers, COUNT(DISTINCT "DOC_NO")::int AS docs
     FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1", daysOf(period, safeMonth))} AND "SMAN_NAME" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, [ymOf(year, safeMonth)]);
  return rows;
}
