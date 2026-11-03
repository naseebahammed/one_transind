import { cacheLife } from "next/cache";
import { pg } from "@/lib/pg";
import { getPeriod } from "@/lib/period";

// Sales value = every row of the view: IN invoices plus CR credit notes (already negative). Verified against the finance sheet Jan-Sep 2026.
const table = process.env.SALES_TABLE!;
const TOP_ITEMS = 25;
const TOP_CUSTOMERS = 60;

// Date-range filters instead of to_char/EXTRACT on the column, so an index on DOC_DATE can be used. p is a "YYYY-MM" parameter.
const inMonth = (col: string, p: string) => `(${col} >= (${p}::text||'-01')::date AND ${col} < (${p}::text||'-01')::date + interval '1 month')`;
const inMonths = (col: string, ...ps: string[]) => "(" + ps.map((p) => inMonth(col, p)).join(" OR ") + ")";
// January to month m (1-12) of year y.
const inYtd = (col: string, y: string, m: string) => `(${col} >= make_date((${y})::int,1,1) AND ${col} < make_date((${y})::int,(${m})::int,1) + interval '1 month')`;

export type Item = { n: string; v: number; lm: number; u: number };
export type Brand = { n: string; v: number; lm: number; items: Item[] };
export type Hist = { y: number; m: number; v: number; c: number; cr: number };
export type Cust = { id: string; name: string; cat: string; group: string; months: number[]; ytd: number; mtd: number; lm: number; brands: { n: string; v: number; lm: number }[] };

/** Sales and cost per year and month, all history. */
export async function getHistory(): Promise<Hist[]> {
  "use cache";
  cacheLife("minutes");
  const { rows } = await pg.query<Hist>(
    `SELECT EXTRACT(year FROM "DOC_DATE")::int AS y, EXTRACT(month FROM "DOC_DATE")::int AS m,
            SUM("NET_AMOUNT")::float8 AS v, SUM("NET_COST")::float8 AS c,
            COALESCE(SUM("NET_AMOUNT") FILTER (WHERE "DOC_TYPE" = 'CR'), 0)::float8 AS cr
     FROM ${table} GROUP BY 1,2 ORDER BY 1,2`);
  return rows;
}

/** Latest complete month plus the current year's monthly totals up to it. */
export async function getOverview() {
  "use cache";
  cacheLife("minutes");
  const { year, month, cur, before } = await getPeriod(table);
  const hist = await getHistory();
  const months = Array.from({ length: month + 1 }, (_, i) => hist.find((h) => h.y === year && h.m === i + 1) ?? { y: year, m: i + 1, v: 0, c: 0, cr: 0 });

  const { rows } = await pg.query<{ k: string; b: string; i: string; v: number; u: number }>(
    `SELECT to_char("DOC_DATE",'YYYY-MM') AS k, COALESCE("BRAND",'-') AS b, COALESCE("ITEM_NAME",'-') AS i,
            SUM("NET_AMOUNT")::float8 AS v, COALESCE(SUM("QTY_PCS"),0)::float8 AS u FROM ${table}
     WHERE ${inMonths('"DOC_DATE"', "$1", "$2")} GROUP BY 1,2,3`, [cur, before]);
  const brands = new Map<string, { n: string; v: number; lm: number; items: Map<string, Item> }>();
  for (const r of rows) {
    const b = brands.get(r.b) ?? { n: r.b, v: 0, lm: 0, items: new Map() };
    const it = b.items.get(r.i) ?? { n: r.i, v: 0, lm: 0, u: 0 };
    if (r.k === cur) { b.v += r.v; it.v += r.v; it.u += r.u; } else { b.lm += r.v; it.lm += r.v; }
    b.items.set(r.i, it); brands.set(r.b, b);
  }
  const tree: Brand[] = [...brands.values()].filter((b) => b.v || b.lm).map((b) => {
    const items = [...b.items.values()].filter((x) => x.v || x.lm).sort((a, c) => c.v - a.v);
    const top = items.slice(0, TOP_ITEMS), rest = items.slice(TOP_ITEMS);
    if (rest.length) top.push({ n: `Other (${rest.length} items)`, v: rest.reduce((a, x) => a + x.v, 0), lm: rest.reduce((a, x) => a + x.lm, 0), u: rest.reduce((a, x) => a + x.u, 0) });
    return { n: b.n, v: b.v, lm: b.lm, items: top };
  }).sort((a, c) => c.v - a.v);

  return { year, month, months, brands: tree };
}

/** Top customers by year-to-date sales, with monthly series and brand split for the latest complete month. */
export async function getCustomers() {
  "use cache";
  cacheLife("minutes");
  const { year, month, cur, before } = await getPeriod(table);
  const { rows } = await pg.query<{ id: string; name: string; cat: string; grp: string; m: number; v: number }>(
    `SELECT "CUST_NO" AS id, MAX("CUST_NAME") AS name, MAX("CUST_CATEGORY") AS cat, MAX("GROUP_NAME") AS grp,
            EXTRACT(month FROM "DOC_DATE")::int AS m, SUM("NET_AMOUNT")::float8 AS v
     FROM ${table} WHERE ${inYtd('"DOC_DATE"', "$1", "$2")} GROUP BY 1,5`, [year, month + 1]);
  const byId = new Map<string, Cust>();
  for (const r of rows) {
    const c = byId.get(r.id) ?? { id: r.id, name: r.name ?? r.id, cat: r.cat ?? "", group: r.grp ?? "", months: Array(month + 1).fill(0), ytd: 0, mtd: 0, lm: 0, brands: [] };
    c.months[r.m - 1] = r.v; c.ytd += r.v;
    if (r.m - 1 === month) c.mtd = r.v;
    if (r.m - 1 === month - 1) c.lm = r.v;
    byId.set(r.id, c);
  }
  const top = [...byId.values()].sort((a, b) => b.ytd - a.ytd).slice(0, TOP_CUSTOMERS);
  const { rows: br } = await pg.query<{ id: string; k: string; b: string; v: number }>(
    `SELECT "CUST_NO" AS id, to_char("DOC_DATE",'YYYY-MM') AS k, COALESCE("BRAND",'-') AS b, SUM("NET_AMOUNT")::float8 AS v
     FROM ${table} WHERE "CUST_NO" = ANY($1) AND ${inMonths('"DOC_DATE"', "$2", "$3")} GROUP BY 1,2,3`, [top.map((c) => c.id), cur, before]);
  const idx = new Map(top.map((c) => [c.id, c]));
  const tmp = new Map<string, Map<string, { n: string; v: number; lm: number }>>();
  for (const r of br) {
    const m = tmp.get(r.id) ?? new Map();
    const b = m.get(r.b) ?? { n: r.b, v: 0, lm: 0 };
    if (r.k === cur) b.v += r.v; else b.lm += r.v;
    m.set(r.b, b); tmp.set(r.id, m);
  }
  for (const [id, m] of tmp) idx.get(id)!.brands = [...m.values()].filter((b) => b.v || b.lm).sort((a, b) => b.v - a.v);
  return { year, month, customers: top, customerCount: byId.size };
}

/** Sales by brand for one calendar month across every year in the table. */
export async function getBrandYears(month: number) {
  "use cache";
  cacheLife("minutes");
  const { rows } = await pg.query<{ y: number; b: string; v: number }>(
    `SELECT EXTRACT(year FROM "DOC_DATE")::int AS y, COALESCE("BRAND",'-') AS b, SUM("NET_AMOUNT")::float8 AS v
     FROM ${table} WHERE EXTRACT(month FROM "DOC_DATE") = $1 GROUP BY 1,2`, [month + 1]);
  return rows;
}

export const DIMENSIONS = {
  dept: { label: "Department", sql: `COALESCE(d.department_name, s."DEPT_CODE", '-')`, join: `LEFT JOIN public.invs_departments d ON d.department_code = s."DEPT_CODE"` },
  brand: { label: "Brand", sql: `COALESCE(s."BRAND", '-')`, join: "" },
  supplier: { label: "Supplier", sql: `COALESCE(s."SUPPLIER_NAME", '-')`, join: "" },
  category: { label: "Customer category", sql: `COALESCE(s."CUST_CATEGORY", '-')`, join: "" },
  group: { label: "Customer group", sql: `COALESCE(s."GROUP_NAME", '-')`, join: "" },
  salesman: { label: "Salesman", sql: `COALESCE(s."SMAN_NAME", '-')`, join: "" },
} as const;
export type Dim = keyof typeof DIMENSIONS;
export type Row = { k: string; v: number; c: number; cr: number; lv: number };

const ymOf = (y: number, m: number) => `${y + Math.floor(m / 12)}-${String((((m % 12) + 12) % 12) + 1).padStart(2, "0")}`;

/** One month of sales split by a dimension, with cost, credit notes and the previous month's sales. */
export async function getBreakdown(month: number, by: Dim) {
  "use cache";
  cacheLife("minutes");
  const { year } = await getPeriod(table);
  const cur = ymOf(year, month), before = ymOf(year, month - 1), d = DIMENSIONS[by];
  const { rows } = await pg.query<{ k: string; ym: string; v: number; c: number; cr: number }>(
    `SELECT ${d.sql} AS k, to_char(s."DOC_DATE",'YYYY-MM') AS ym, SUM(s."NET_AMOUNT")::float8 AS v, SUM(s."NET_COST")::float8 AS c,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE s."DOC_TYPE" = 'CR'), 0)::float8 AS cr
     FROM ${table} s ${d.join} WHERE ${inMonths('s."DOC_DATE"', "$1", "$2")} GROUP BY 1,2`, [cur, before]);
  const map = new Map<string, Row>();
  for (const r of rows) {
    const x = map.get(r.k) ?? { k: r.k, v: 0, c: 0, cr: 0, lv: 0 };
    if (r.ym === cur) { x.v = r.v; x.c = r.c; x.cr = r.cr; } else x.lv = r.v;
    map.set(r.k, x);
  }
  const { rows: [n] } = await pg.query<{ customers: number; items: number }>(
    `SELECT COUNT(DISTINCT "CUST_NO")::int AS customers, COUNT(DISTINCT "ITEM_CODE")::int AS items FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1")}`, [cur]);
  return { year, rows: [...map.values()].filter((r) => r.v || r.lv).sort((a, b) => b.v - a.v), customers: n.customers, items: n.items };
}

/** Delivery routes and drivers for one month, from the sales documents (no fleet or warehouse source exists). */
export async function getRoutes(month: number) {
  "use cache";
  cacheLife("minutes");
  const { year } = await getPeriod(table);
  const cur = ymOf(year, month), before = ymOf(year, month - 1);
  const [{ rows: routes }, { rows: drivers }] = await Promise.all([
    pg.query<{ k: string; ym: string; v: number; drivers: number; docs: number }>(
      `SELECT COALESCE("ROUTE_DESC",'-') AS k, to_char("DOC_DATE",'YYYY-MM') AS ym, SUM("NET_AMOUNT")::float8 AS v,
              COUNT(DISTINCT "DRIVER_NAME")::int AS drivers, COUNT(DISTINCT "DOC_NO")::int AS docs
       FROM ${table} WHERE ${inMonths('"DOC_DATE"', "$1", "$2")} GROUP BY 1,2`, [cur, before]),
    pg.query<{ name: string; v: number; customers: number; docs: number }>(
      `SELECT "DRIVER_NAME" AS name, SUM("NET_AMOUNT")::float8 AS v, COUNT(DISTINCT "CUST_NO")::int AS customers, COUNT(DISTINCT "DOC_NO")::int AS docs
       FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1")} AND "DRIVER_NAME" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, [cur]),
  ]);
  const map = new Map<string, { k: string; v: number; lv: number; drivers: number; docs: number }>();
  for (const r of routes) {
    const x = map.get(r.k) ?? { k: r.k, v: 0, lv: 0, drivers: 0, docs: 0 };
    if (r.ym === cur) { x.v = r.v; x.drivers = r.drivers; x.docs = r.docs; } else x.lv = r.v;
    map.set(r.k, x);
  }
  return { year, routes: [...map.values()].filter((r) => r.v || r.lv).sort((a, b) => b.v - a.v), drivers };
}

export type DrillRow = { k: string; label: string; sub: string; v: number; lv: number; ly: number; ly2: number; c: number; u: number };
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
export const DRILL_DEPTH = { p: 3, c: 4 };

/** One level of a drill-down for a month: p = department > brand > item, c = customer group > customer > brand > item. */
export async function getDrill(month: number, kind: "p" | "c", path: string[], dept = "") {
  "use cache";
  cacheLife("minutes");
  const { year } = await getPeriod(table);
  const ym = [ymOf(year, month), ymOf(year, month - 1), ymOf(year - 1, month), ymOf(year - 2, month)];
  if (path.length >= LEVELS[kind].length) return []; // a path as deep as the leaf level (or deeper, e.g. from a hand-edited URL) has no children
  const lv = LEVELS[kind][path.length];
  const params: string[] = [...ym];
  const where = path.map((p, i) => { params.push(p); return `${LEVELS[kind][i].key}::text = $${params.length}`; });
  if (dept && kind === "p" && !path.length) { params.push(dept); where.push(`COALESCE(s."DEPT_CODE",'-')::text = $${params.length}`); }
  const ymSql = `to_char(s."DOC_DATE",'YYYY-MM')`;
  const sql = lv.sub.replaceAll("cur", `${ymSql} = $1`);
  const { rows } = await pg.query<DrillRow>(
    `SELECT ${lv.key} AS k, ${lv.label} AS label, ${sql} AS sub,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${ymSql} = $1),0)::float8 AS v,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${ymSql} = $2),0)::float8 AS lv,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${ymSql} = $3),0)::float8 AS ly,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE ${ymSql} = $4),0)::float8 AS ly2,
            COALESCE(SUM(s."NET_COST") FILTER (WHERE ${ymSql} = $1),0)::float8 AS c,
            COALESCE(SUM(s."QTY_PCS") FILTER (WHERE ${ymSql} = $1),0)::float8 AS u
     FROM ${table} s LEFT JOIN public.invs_departments d ON d.department_code = s."DEPT_CODE"
     WHERE ${inMonths('s."DOC_DATE"', "$1", "$2", "$3", "$4")}${where.length ? " AND " + where.join(" AND ") : ""}
     GROUP BY 1 ORDER BY v DESC`, params);
  return rows.filter((r) => r.v || r.lv || r.ly || r.ly2 || r.c);
}

/** Label of the node a path ends at, for breadcrumbs. */
export async function getDrillLabels(month: number, kind: "p" | "c", path: string[]) {
  const out: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const rows = await getDrill(month, kind, path.slice(0, i));
    out.push(rows.find((r) => r.k === path[i])?.label ?? path[i]);
  }
  return out;
}

/** Monthly sales per year (all years), optionally for one department. */
export async function getMonthly(dept = "") {
  "use cache";
  cacheLife("minutes");
  const { rows } = await pg.query<{ y: number; m: number; v: number }>(
    `SELECT EXTRACT(year FROM "DOC_DATE")::int AS y, EXTRACT(month FROM "DOC_DATE")::int AS m, SUM("NET_AMOUNT")::float8 AS v
     FROM ${table} ${dept ? `WHERE "DEPT_CODE" = $1` : ""} GROUP BY 1,2 ORDER BY 1,2`, dept ? [dept] : []);
  return rows;
}

/** Department list with year-to-date sales, cost and previous-year YTD for the latest complete month. */
export async function getSectors() {
  "use cache";
  cacheLife("minutes");
  const { year, month } = await getPeriod(table);
  const { rows } = await pg.query<{ k: string; label: string; v: number; c: number; ly: number }>(
    `SELECT COALESCE(s."DEPT_CODE",'-') AS k, MAX(COALESCE(d.department_name, s."DEPT_CODE", '-')) AS label,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE EXTRACT(year FROM s."DOC_DATE") = $1),0)::float8 AS v,
            COALESCE(SUM(s."NET_COST") FILTER (WHERE EXTRACT(year FROM s."DOC_DATE") = $1),0)::float8 AS c,
            COALESCE(SUM(s."NET_AMOUNT") FILTER (WHERE EXTRACT(year FROM s."DOC_DATE") = $1 - 1),0)::float8 AS ly
     FROM ${table} s LEFT JOIN public.invs_departments d ON d.department_code = s."DEPT_CODE"
     WHERE (${inYtd('s."DOC_DATE"', "$2", "$3")} OR ${inYtd('s."DOC_DATE"', "$2 - 1", "$3")}) GROUP BY 1 ORDER BY v DESC`, [year, year, month + 1]);
  return rows.filter((r) => r.v || r.ly);
}

/** Per group or brand: sales, cost, items and customers for one month. */
export async function getStats(month: number, by: "group" | "brand") {
  "use cache";
  cacheLife("minutes");
  const { year } = await getPeriod(table);
  const col = by === "group" ? `COALESCE("GROUP_NAME",'-')` : `COALESCE("BRAND",'-')`;
  const { rows } = await pg.query<{ k: string; v: number; c: number; items: number; customers: number }>(
    `SELECT ${col} AS k, SUM("NET_AMOUNT")::float8 AS v, SUM("NET_COST")::float8 AS c,
            COUNT(DISTINCT "ITEM_CODE")::int AS items, COUNT(DISTINCT "CUST_NO")::int AS customers
     FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1")} GROUP BY 1 ORDER BY v DESC`, [ymOf(year, month)]);
  return rows;
}

/** Salesmen with sales for one month. */
export async function getSalesmen(month: number) {
  "use cache";
  cacheLife("minutes");
  const { year } = await getPeriod(table);
  const { rows } = await pg.query<{ name: string; v: number; customers: number; docs: number }>(
    `SELECT "SMAN_NAME" AS name, SUM("NET_AMOUNT")::float8 AS v, COUNT(DISTINCT "CUST_NO")::int AS customers, COUNT(DISTINCT "DOC_NO")::int AS docs
     FROM ${table} WHERE ${inMonth('"DOC_DATE"', "$1")} AND "SMAN_NAME" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, [ymOf(year, month)]);
  return rows;
}
