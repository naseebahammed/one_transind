import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { numbering, q, q1 } from "@/lib/db";
import type { Balances } from "@/lib/fmcg-balances";
import type { Control } from "@/lib/fmcg-control";
import type { Masters } from "@/lib/fmcg-masters";
import type { CogsRow, DailyRow, ImportIssue, ReceiptRow } from "@/lib/report-parsers";
import { LINES, type Figure, type FigureSection } from "@/lib/company-data";
import { branchClash, monthlySalesClash, takingsClash } from "@/lib/figure-rules";

/** One uploaded file, kept with its import so it can be re-read or downloaded later. */
export type Upload = { companyId: number; section: string; name: string; type: string; buf: Buffer; branchId?: number | null };
type FigureRow = { year: number; month: number; main: string; line: string; unit_type?: string; value: number };

const period = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}-01`;
const inYear = (col: string, p: string) => `${col} >= make_date(${p}::int,1,1) AND ${col} < make_date(${p}::int + 1,1,1)`;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** branchId null = the company-level rows; pass a branch id for that branch only. */
export const listFigures = (companyId: number, section: FigureSection, year: number, branchId: number | null = null) =>
  q<Figure>(`SELECT EXTRACT(year FROM period)::int AS year, EXTRACT(month FROM period)::int - 1 AS month, line, value::float8 AS value FROM app.company_figures WHERE company_id=$1 AND section=$2 AND ${inYear("period", "$3")} AND branch_id IS NOT DISTINCT FROM $4`, [companyId, section, year, branchId]);

/** Yearly expense total per company, for the company list. Summed across branches; ABS guards against any legacy negative row. */
export const listExpenseTotals = () =>
  q<{ company_id: number; year: number; value: number }>("SELECT company_id, EXTRACT(year FROM period)::int AS year, SUM(ABS(value))::float8 AS value FROM app.company_figures WHERE section='expenses' GROUP BY 1, 2");

/** Monthly expense total of every company (summed across branches), for the finance page. */
export const listExpenses = () =>
  q<{ company_id: number; year: number; month: number; value: number }>("SELECT company_id, EXTRACT(year FROM period)::int AS year, EXTRACT(month FROM period)::int - 1 AS month, SUM(ABS(value))::float8 AS value FROM app.company_figures WHERE section='expenses' GROUP BY 1, 2, 3");

type FilledMonths = Record<FigureSection | "pnl", Set<number>>;
const emptyFilled = (): FilledMonths => ({ pnl: new Set(), balance: new Set(), budget: new Set(), people: new Set(), expenses: new Set() });
const isMonthFilled = (section: FigureSection | "pnl", n: number) => section === "pnl" || (section in LINES && n >= LINES[section as FigureSection].length);

/** Which months of a year each section has on file. Omit branchId to check across the whole company (including branch uploads); pass null for company-level rows only. */
export async function listFilledMonths(companyId: number, year: number, branchId?: number | null) {
  const out = emptyFilled();
  for (const r of await q<{ section: FigureSection | "pnl"; month: number; n: number }>(`SELECT section, EXTRACT(month FROM period)::int - 1 AS month, COUNT(DISTINCT line)::int AS n FROM app.company_figures WHERE company_id=$1 AND ${inYear("period", "$2")} AND ($3::boolean OR branch_id IS NOT DISTINCT FROM $4) GROUP BY 1, 2`, [companyId, year, branchId === undefined, branchId ?? null]))
    if (isMonthFilled(r.section, r.n)) out[r.section]?.add(r.month);
  return out;
}

/** Which months of a year each section has on file for every company, in one query (for the data-status matrix). */
export async function listAllFilledMonths(year: number) {
  const out = new Map<number, FilledMonths>();
  for (const r of await q<{ company_id: number; section: FigureSection | "pnl"; month: number; n: number }>(`SELECT company_id, section, EXTRACT(month FROM period)::int - 1 AS month, COUNT(DISTINCT line)::int AS n FROM app.company_figures WHERE ${inYear("period", "$1")} GROUP BY 1, 2, 3`, [year])) {
    if (!isMonthFilled(r.section, r.n)) continue;
    let m = out.get(r.company_id);
    if (!m) out.set(r.company_id, m = emptyFilled());
    m[r.section]?.add(r.month);
  }
  return (companyId: number) => out.get(companyId) ?? emptyFilled();
}

/** Group of each line in a section, from the chart. */
export const linesOf = async (section: string) => new Map((await q<{ main: string; sub: string }>("SELECT main, sub FROM app.accounts WHERE section=$1", [section])).map((a) => [a.sub, a.main]));

/** Keeps a refused file and the reason, so a failed upload is visible afterwards. */
export async function recordRejected(u: Upload, error: string) {
  const hash = sha(u.buf);
  await q("INSERT INTO app.import_files(sha256,file) VALUES($1,$2) ON CONFLICT (sha256) DO NOTHING", [hash, u.buf]);
  await q("INSERT INTO app.imports(company_id,section,file_name,file_type,file_size,sha256,status,error) VALUES($1,$2,$3,$4,$5,$6,'rejected',$7)", [u.companyId, u.section, u.name, u.type, u.buf.length, hash, error]);
}

/** How completely a file loaded. controlTotal is the total the sheet itself prints, to compare with what was loaded. */
type ImportQuality = { rowsRead: number; controlTotal: number | null; issues: ImportIssue[] };

async function addImport(c: PoolClient, u: Upload, rows: number, periods: string[], quality?: ImportQuality) {
  const sorted = [...periods].sort(), issues = quality?.issues ?? [], hash = sha(u.buf);
  await c.query("INSERT INTO app.import_files(sha256,file) VALUES($1,$2) ON CONFLICT (sha256) DO NOTHING", [hash, u.buf]);
  const { rows: [r] } = await c.query<{ id: number }>("INSERT INTO app.imports(company_id,section,file_name,file_type,file_size,sha256,status,rows_loaded,period_from,period_to,rows_read,rows_rejected,control_total) VALUES($1,$2,$3,$4,$5,$6,'loaded',$7,$8,$9,$10,$11,$12) RETURNING id",
    [u.companyId, u.section, u.name, u.type, u.buf.length, hash, rows, sorted[0] ?? null, sorted.at(-1) ?? null, quality?.rowsRead ?? null, issues.filter((x) => !x.loaded).length, quality?.controlTotal ?? null]);
  if (issues.length) await c.query("INSERT INTO stg.rejected_rows(import_id,sheet,row_no,reason,loaded) SELECT $1,s,n,m,l FROM unnest($2::text[],$3::int[],$4::text[],$5::boolean[]) AS t(s,n,m,l)",
    [r.id, issues.map((x) => x.sheet), issues.map((x) => x.row), issues.map((x) => x.reason), issues.map((x) => x.loaded)]);
  return r.id;
}

/** All or nothing: the months in the file are replaced as a whole, every other month stays as it is. */
export const importFigures = (u: Upload, rows: FigureRow[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => period(r.year, r.month)))];
    const clash = await branchClash(c, u.companyId, u.section, periods, u.branchId ?? null) ?? (u.section === "sales" ? await monthlySalesClash(c, u.companyId, periods) : null);
    if (clash) throw new Error(clash);
    const id = await addImport(c, u, rows.length, periods);
    await c.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period = ANY($3::date[]) AND branch_id IS NOT DISTINCT FROM $4", [u.companyId, u.section, periods, u.branchId ?? null]);
    const latest = [...new Map(rows.map((r) => [`${r.year}|${r.month}|${r.main}|${r.line}|${r.unit_type ?? ""}`, r])).values()];
    if (latest.length)
      await c.query(
        `INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value,import_id,branch_id)
         SELECT $1,$2,p,m,l,u,v,$8,$9 FROM unnest($3::date[],$4::text[],$5::text[],$6::text[],$7::numeric[]) AS t(p,m,l,u,v)
         ON CONFLICT ON CONSTRAINT company_figures_key DO UPDATE SET value=EXCLUDED.value,import_id=EXCLUDED.import_id,updated=now()`,
        [u.companyId, u.section, latest.map((r) => period(r.year, r.month)), latest.map((r) => r.main), latest.map((r) => r.line), latest.map((r) => r.unit_type ?? ""), latest.map((r) => r.value), id, u.branchId ?? null],
      );
  }, u.companyId);

/** All or nothing, as one import: the months in the file are replaced for each branch of the company the file has a column for. */
export const importCogs = (u: Upload, rows: (CogsRow & { branchId: number | null })[], issues: ImportIssue[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => period(r.year, r.month)))];
    const branches = [...new Set(rows.map((r) => r.branchId))];
    const id = await addImport(c, u, rows.length, periods, { rowsRead: rows.length, controlTotal: null, issues });
    if (branches.length)
      await c.query("DELETE FROM app.company_figures f USING unnest($3::int[]) AS b(id) WHERE f.company_id=$1 AND f.section='cogs' AND f.period = ANY($2::date[]) AND f.branch_id IS NOT DISTINCT FROM b.id", [u.companyId, periods, branches]);
    const latest = [...new Map(rows.map((r) => [`${r.branchId ?? 0}|${r.year}|${r.month}|${r.line}`, r])).values()];
    if (latest.length)
      await c.query(
        `INSERT INTO app.company_figures(company_id,section,period,main,line,value,import_id,branch_id)
         SELECT $1,'cogs',p,'COGS',l,v,$6,b FROM unnest($2::date[],$3::text[],$4::numeric[],$5::int[]) AS t(p,l,v,b)
         ON CONFLICT ON CONSTRAINT company_figures_key DO UPDATE SET value=EXCLUDED.value,import_id=EXCLUDED.import_id,updated=now()`,
        [u.companyId, latest.map((r) => period(r.year, r.month)), latest.map((r) => r.line), latest.map((r) => r.value), latest.map((r) => r.branchId), id],
      );
  }, u.companyId);

/** All or nothing, as one import. Reference rows are updated in place and never removed, because old sales will point at them; a month's targets replace that month. */
export const importMasters = (u: Upload, m: Masters) =>
  numbering(async (c) => {
    const id = await addImport(c, u, m.rowsRead, m.period ? [m.period] : [], { rowsRead: m.rowsRead, controlTotal: m.controlTotal, issues: m.issues });
    const pick = <T,>(rows: T[], ...keys: (keyof T)[]) => keys.map((k) => rows.map((r) => r[k]));
    if (m.brands.length) await c.query(`INSERT INTO app.brands(code,name,department,manager,category) SELECT * FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[])
      ON CONFLICT (code) DO UPDATE SET department=COALESCE(EXCLUDED.department,app.brands.department), manager=COALESCE(EXCLUDED.manager,app.brands.manager), category=COALESCE(EXCLUDED.category,app.brands.category)`, pick(m.brands, "code", "name", "department", "manager", "category"));
    if (m.salesmen.length) await c.query(`INSERT INTO app.salesmen(code,name,status,team_lead,manager,sales_category,route,import_id) SELECT a,b,d,e,f,g,h,$8 FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[]) AS t(a,b,d,e,f,g,h)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,team_lead=EXCLUDED.team_lead,manager=EXCLUDED.manager,sales_category=EXCLUDED.sales_category,route=EXCLUDED.route,import_id=EXCLUDED.import_id,updated=now()`, [...pick(m.salesmen, "code", "name", "status", "teamLead", "manager", "salesCategory", "route"), id]);
    if (m.customers.length) await c.query(`INSERT INTO app.customers(code,name,group_name,credit_days,accountant,status,balance,import_id) SELECT a,b,d,e,f,g,h,$8 FROM unnest($1::text[],$2::text[],$3::text[],$4::int[],$5::text[],$6::text[],$7::numeric[]) AS t(a,b,d,e,f,g,h)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,group_name=EXCLUDED.group_name,credit_days=EXCLUDED.credit_days,accountant=EXCLUDED.accountant,status=EXCLUDED.status,balance=EXCLUDED.balance,import_id=EXCLUDED.import_id,updated=now()`, [...pick(m.customers, "code", "name", "groupName", "creditDays", "accountant", "status", "balance"), id]);
    if (m.items.length) await c.query(`INSERT INTO app.items(code,name,brand,packing,size,item_type,department,manager,import_id) SELECT a,b,d,e,f,g,h,i,$9 FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[]) AS t(a,b,d,e,f,g,h,i)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,brand=EXCLUDED.brand,packing=EXCLUDED.packing,size=EXCLUDED.size,item_type=EXCLUDED.item_type,department=EXCLUDED.department,manager=EXCLUDED.manager,import_id=EXCLUDED.import_id,updated=now()`, [...pick(m.items, "code", "name", "brand", "packing", "size", "itemType", "department", "manager"), id]);
    if (!m.period) return;
    // A target file can name a salesman the Market Audit has not listed yet; keep the row and let the next audit fill in the details.
    await c.query("INSERT INTO app.salesmen(code,name,import_id) SELECT DISTINCT ON (a) a,b,$3::int FROM unnest($1::text[],$2::text[]) AS t(a,b) ON CONFLICT (code) DO NOTHING", [...pick(m.assignments, "salesmanCode", "salesmanName"), id]);
    await c.query("DELETE FROM app.sales_assignments WHERE period=$1", [m.period]);
    await c.query("DELETE FROM app.manager_targets WHERE period=$1", [m.period]);
    await c.query("INSERT INTO app.sales_assignments(period,salesman_code,brand,supervisor,channel,department,target,import_id) SELECT $1::date,a,b,d,e,f,g,$8 FROM unnest($2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::numeric[]) AS t(a,b,d,e,f,g)", [m.period, ...pick(m.assignments, "salesmanCode", "brand", "supervisor", "channel", "department", "target"), id]);
    await c.query("INSERT INTO app.manager_targets(period,manager,target,import_id) SELECT $1::date,a,b,$4 FROM unnest($2::text[],$3::numeric[]) AS t(a,b)", [m.period, ...pick(m.managerTargets, "manager", "target"), id]);
  }, u.companyId);

/** All or nothing, as one import. A day's stock replaces that day only, so earlier days stay on file. An item the masters don't have yet is added, so a new product never rejects the file. */
export const importBalances = (u: Upload, b: Balances) =>
  numbering(async (c) => {
    const periods = [...new Set([b.stockDate].filter((d): d is string => !!d).map((d) => `${d.slice(0, 7)}-01`))];
    const id = await addImport(c, u, b.rowsRead, periods, { rowsRead: b.rowsRead, controlTotal: b.stockTotal, issues: b.issues });
    const pick = <T,>(rows: T[], ...keys: (keyof T)[]) => keys.map((k) => rows.map((r) => r[k]));
    if (b.stockDate) {
      await c.query("INSERT INTO app.brands(code,name) SELECT DISTINCT a,a FROM unnest($1::text[]) AS t(a) WHERE a <> '' ON CONFLICT (code) DO NOTHING", [b.items.map((i) => i.brand)]);
      await c.query(`INSERT INTO app.items(code,name,brand,packing,size,item_type,department,manager,import_id) SELECT a,b,d,e,f,g,h,i,$9 FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[]) AS t(a,b,d,e,f,g,h,i) ON CONFLICT (code) DO NOTHING`, [...pick(b.items, "code", "name", "brand", "packing", "size", "itemType", "department", "manager"), id]);
      await c.query("DELETE FROM app.stock_snapshots WHERE as_of=$1", [b.stockDate]);
      await c.query("INSERT INTO app.stock_snapshots(as_of,item_code,location,qty_current,qty_allocated,qty_balance,value,import_id) SELECT $1::date,a,b,d,e,f,g,$8 FROM unnest($2::text[],$3::text[],$4::numeric[],$5::numeric[],$6::numeric[],$7::numeric[]) AS t(a,b,d,e,f,g)", [b.stockDate, ...pick(b.stock, "itemCode", "location", "qtyCurrent", "qtyAllocated", "qtyBalance", "value"), id]);
    }
  }, u.companyId);

/** All or nothing, as one import. Each report replaces only the dates (or the report and date) it covers. */
export const importControl = (u: Upload, r: Control) =>
  numbering(async (c) => {
    const periods = [...new Set([...r.variances.map((x) => x.doDate), ...r.consignments.map((x) => x.receivedDate), ...(r.expiryDate ? [r.expiryDate] : [])].map((d) => `${d.slice(0, 7)}-01`))];
    const id = await addImport(c, u, r.rowsRead, periods, { rowsRead: r.rowsRead, controlTotal: r.controlTotal, issues: r.issues });
    const pick = <T,>(rows: T[], ...keys: (keyof T)[]) => keys.map((k) => rows.map((x) => x[k]));
    if (r.variances.length) {
      await c.query("DELETE FROM app.delivery_variances WHERE do_date = ANY($1::date[])", [r.variances.map((x) => x.doDate)]);
      await c.query("INSERT INTO app.delivery_variances(do_date,do_no,item_code,location,customer_code,customer,salesman,store_in_charge,driver,item,brand,manager,supervisor,qty_rv,qty_do,value_rv,value_do,import_id) SELECT *, $18::int FROM unnest($1::date[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[],$9::text[],$10::text[],$11::text[],$12::text[],$13::text[],$14::numeric[],$15::numeric[],$16::numeric[],$17::numeric[])",
        [...pick(r.variances, "doDate", "doNo", "itemCode", "location", "customerCode", "customer", "salesman", "storeInCharge", "driver", "item", "brand", "manager", "supervisor", "qtyRv", "qtyDo", "valueRv", "valueDo"), id]);
    }
    if (r.consignments.length) {
      await c.query("DELETE FROM app.consignment_receipts WHERE received_date = ANY($1::date[])", [r.consignments.map((x) => x.receivedDate)]);
      await c.query("INSERT INTO app.consignment_receipts(received_date,line_no,consignment_no,order_no,invoice_no,invoice_date,supplier,location,item_code,item,expiry_date,excise,billed_qty,received_qty,import_id) SELECT *, $15::int FROM unnest($1::date[],$2::int[],$3::text[],$4::text[],$5::text[],$6::date[],$7::text[],$8::text[],$9::text[],$10::text[],$11::date[],$12::text[],$13::numeric[],$14::numeric[])",
        [...pick(r.consignments, "receivedDate", "lineNo", "consignmentNo", "orderNo", "invoiceNo", "invoiceDate", "supplier", "location", "itemCode", "item", "expiryDate", "excise", "billedQty", "receivedQty"), id]);
    }
    if (r.expiryDate) {
      await c.query("DELETE FROM app.stock_expiry WHERE as_of=$1 AND report=$2", [r.expiryDate, r.expiryReport]);
      await c.query("INSERT INTO app.stock_expiry(as_of,report,line_no,item_code,item,size,packing,brand,category,location,cartons,outers,pieces,total_cost,expiry_date,remarks,import_id) SELECT $1::date,$2::text,a.*,$17::int FROM unnest($3::int[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[],$9::text[],$10::text[],$11::numeric[],$12::numeric[],$13::numeric[],$14::numeric[],$15::date[],$16::text[]) AS a",
        [r.expiryDate, r.expiryReport, ...pick(r.expiry, "lineNo", "itemCode", "item", "size", "packing", "brand", "category", "location", "cartons", "outers", "pieces", "totalCost", "expiryDate", "remarks"), id]);
    }
  }, u.companyId);

const DAILY = ["long_guests", "long_rate", "long_total", "short_guests", "short_rate", "short_total", "rooms_occupied", "room_revenue", "other_revenue", "rooms_available"] as const;

/** All or nothing: the months in the file are replaced as a whole (so a cleared day removes its old row), every other month stays as it is. */
export const importDaily = (u: Upload, rows: DailyRow[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => `${r.date.slice(0, 7)}-01`))];
    const id = await addImport(c, u, rows.length, periods);
    await c.query("DELETE FROM app.daily_sales d USING unnest($2::date[]) AS p(m) WHERE d.company_id=$1 AND d.branch_id IS NOT DISTINCT FROM $3 AND d.date >= p.m AND d.date < (p.m + interval '1 month')::date", [u.companyId, periods, u.branchId ?? null]);
    const latest = [...new Map(rows.map((r) => [r.date, r])).values()];
    if (latest.length)
      await c.query(
        `INSERT INTO app.daily_sales(company_id,date,${DAILY.join(",")},import_id,branch_id)
         SELECT $1,d,${DAILY.map((_, i) => `c${i}`).join(",")},$13,$14
         FROM unnest($2::date[],${DAILY.map((_, i) => `$${i + 3}::numeric[]`).join(",")}) AS t(d,${DAILY.map((_, i) => `c${i}`).join(",")})
         ON CONFLICT ON CONSTRAINT daily_sales_key DO UPDATE SET ${DAILY.map((k) => `${k}=EXCLUDED.${k}`).join(",")},import_id=EXCLUDED.import_id,updated=now()`,
        [u.companyId, latest.map((r) => r.date), ...DAILY.map((k) => latest.map((r) => r[k])), id, u.branchId ?? null],
      );
  }, u.companyId);

/** One figure typed by hand: no import, so import_id is cleared. When branchId is omitted (company-wide grid), any branch rows for that cell are replaced so they do not double-count. Returns the reason when the save is refused, null when saved. */
export function setFigure(companyId: number, section: string, year: number, month: number, main: string, line: string, unitType: string, value: number, branchId?: number | null) {
  if (!Number.isFinite(value)) throw new Error("Value must be a number.");
  if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error("Month must be 0-11.");
  const p = period(year, month), v = Math.round(value * 100) / 100;
  return numbering(async (c) => {
    const clash = (branchId === undefined ? null : await branchClash(c, companyId, section, [p], branchId)) ?? (section === "sales" ? await monthlySalesClash(c, companyId, [p]) : null);
    if (clash) return clash;
    if (branchId === undefined) await c.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period=$3 AND main=$4 AND line=$5 AND unit_type=$6 AND branch_id IS NOT NULL", [companyId, section, p, main, line, unitType]);
    await c.query(`INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT ON CONSTRAINT company_figures_key DO UPDATE SET value=EXCLUDED.value, import_id=NULL, updated=now()`, [companyId, section, p, main, line, unitType, v, branchId ?? null]);
    return null;
  }, companyId);
}

export const deleteFigureMonth = (companyId: number, section: FigureSection, year: number, month: number, branchId: number | null = null) =>
  q("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period=$3 AND branch_id IS NOT DISTINCT FROM $4", [companyId, section, period(year, month), branchId]);

export const deleteFigureYear = (companyId: number, section: string, year: number, branchId?: number | null) =>
  q(`DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND ${inYear("period", "$3")} AND ($4::boolean OR branch_id IS NOT DISTINCT FROM $5)`, [companyId, section, year, branchId === undefined, branchId ?? null]);

export const deleteDailyYearRows = (companyId: number, year: number, branchId?: number | null) =>
  q(`DELETE FROM app.daily_sales WHERE company_id=$1 AND ${inYear("date", "$2")} AND ($3::boolean OR branch_id IS NOT DISTINCT FROM $4)`, [companyId, year, branchId === undefined, branchId ?? null]);

type ImportRow = { id: number; company: string; section: string; source: string; file_name: string; has_file: boolean; status: string; error: string | null; rows_loaded: number; period_from: string | null; period_to: string | null; created: string };
export const listImports = () =>
  q<ImportRow>(`SELECT i.id, c.name AS company, i.section, i.source, i.file_name, EXISTS(SELECT 1 FROM app.import_files f WHERE f.sha256=i.sha256) AS has_file, i.status, i.error, i.rows_loaded,
      to_char(i.period_from,'Mon YYYY') AS period_from, to_char(i.period_to,'Mon YYYY') AS period_to, to_char(i.created AT TIME ZONE 'Asia/Qatar','YYYY-MM-DD HH24:MI') AS created
    FROM app.imports i JOIN app.companies c ON c.id=i.company_id ORDER BY i.id DESC LIMIT 100`);

export const getImportFile = (id: number) =>
  q1<{ file: Buffer | null; file_name: string }>("SELECT f.file, i.file_name FROM app.imports i LEFT JOIN app.import_files f ON f.sha256=i.sha256 WHERE i.id=$1", [id]);

/** Latest month with takings for any branch of the company, as { year, month 0-11 }; null when nothing is uploaded. */
export const latestReceiptMonth = async (companyId: number) => {
  const row = await q1<{ year: number; month: number }>(`SELECT EXTRACT(year FROM max(date))::int AS year, EXTRACT(month FROM max(date))::int - 1 AS month FROM app.daily_receipts WHERE company_id=$1`, [companyId]);
  return row && row.year != null ? row : null;
};

/** One branch's takings for one month (month 0-11), a row per day and channel. */
export const listReceipts = (branchId: number, year: number, month: number) =>
  q<ReceiptRow>(`SELECT to_char(date,'YYYY-MM-DD') AS date, line, value::float8 AS value FROM app.daily_receipts WHERE branch_id=$1 AND date >= make_date($2::int,$3::int + 1,1) AND date < make_date($2::int,$3::int + 1,1) + interval '1 month'`, [branchId, year, month]);

/** Takings of a set of branches for one month (month 0-11), grouped by branch id in a single query. */
export async function listBranchesReceipts(branchIds: number[], year: number, month: number) {
  const out = new Map<number, ReceiptRow[]>();
  if (!branchIds.length) return out;
  for (const r of await q<ReceiptRow & { branch_id: number }>(
    `SELECT branch_id, to_char(date,'YYYY-MM-DD') AS date, line, value::float8 AS value
     FROM app.daily_receipts WHERE branch_id = ANY($1::int[]) AND date >= make_date($2::int,$3::int + 1,1) AND date < make_date($2::int,$3::int + 1,1) + interval '1 month'`,
    [branchIds, year, month])) {
    const list = out.get(r.branch_id);
    const row = { date: r.date, line: r.line, value: r.value };
    if (list) list.push(row); else out.set(r.branch_id, [row]);
  }
  return out;
}

/** All or nothing: the months in the file replace the same months of that branch (so a cleared cell or trailing day removes its old value), every other month stays as it is. */
export const importReceipts = (u: Upload & { branchId: number }, rows: ReceiptRow[], quality: ImportQuality) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => `${r.date.slice(0, 7)}-01`))];
    const clash = await takingsClash(c, u.companyId, periods);
    if (clash) throw new Error(clash);
    const id = await addImport(c, u, rows.length, periods, quality);
    await c.query("DELETE FROM app.daily_receipts r USING unnest($2::date[]) AS p(m) WHERE r.branch_id=$1 AND r.date >= p.m AND r.date < (p.m + interval '1 month')::date", [u.branchId, periods]);
    const latest = [...new Map(rows.map((r) => [`${r.date}|${r.line}`, r])).values()];
    if (latest.length)
      await c.query(`INSERT INTO app.daily_receipts(company_id,branch_id,date,line,value,import_id) SELECT $1,$2,d,l,v,$6 FROM unnest($3::date[],$4::text[],$5::numeric[]) AS t(d,l,v)
        ON CONFLICT (branch_id,date,line) DO UPDATE SET value=EXCLUDED.value,import_id=EXCLUDED.import_id,updated=now()`,
        [u.companyId, u.branchId, latest.map((r) => r.date), latest.map((r) => r.line), latest.map((r) => r.value), id]);
  }, u.companyId);
