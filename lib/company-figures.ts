import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { numbering, q, q1 } from "@/lib/db";
import type { CogsRow, DailyRow, ImportIssue, ReceiptRow } from "@/lib/report-parsers";
import { LINES, type Figure, type FigureSection } from "@/lib/company-data";

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

/** Which months of a year each section has on file. Omit branchId to check across the whole company (including branch uploads); pass null for company-level rows only. */
export async function listFilledMonths(companyId: number, year: number, branchId?: number | null) {
  const out: Record<FigureSection | "pnl", Set<number>> = { pnl: new Set(), balance: new Set(), budget: new Set(), people: new Set(), expenses: new Set() };
  for (const r of await q<{ section: FigureSection | "pnl"; month: number; n: number }>(`SELECT section, EXTRACT(month FROM period)::int - 1 AS month, COUNT(DISTINCT line)::int AS n FROM app.company_figures WHERE company_id=$1 AND ${inYear("period", "$2")} AND ($3::boolean OR branch_id IS NOT DISTINCT FROM $4) GROUP BY 1, 2`, [companyId, year, branchId === undefined, branchId ?? null]))
    if (r.section === "pnl" || (r.section in LINES && r.n >= LINES[r.section as FigureSection].length)) out[r.section]?.add(r.month);
  return out;
}

/** Group of each line in a section, from the chart. */
export const linesOf = async (section: string) => new Map((await q<{ main: string; sub: string }>("SELECT main, sub FROM app.accounts WHERE section=$1", [section])).map((a) => [a.sub, a.main]));

/** Keeps a refused file and the reason, so a failed upload is visible afterwards. */
export const recordRejected = (u: Upload, error: string) =>
  q("INSERT INTO app.imports(company_id,section,file_name,file_type,file_size,sha256,file,status,error) VALUES($1,$2,$3,$4,$5,$6,$7,'rejected',$8)", [u.companyId, u.section, u.name, u.type, u.buf.length, sha(u.buf), u.buf, error]);

/** How completely a file loaded. controlTotal is the total the sheet itself prints, to compare with what was loaded. */
type ImportQuality = { rowsRead: number; controlTotal: number | null; issues: ImportIssue[] };

async function addImport(c: PoolClient, u: Upload, rows: number, periods: string[], quality?: ImportQuality) {
  const sorted = [...periods].sort(), issues = quality?.issues ?? [];
  const { rows: [r] } = await c.query<{ id: number }>("INSERT INTO app.imports(company_id,section,file_name,file_type,file_size,sha256,file,status,rows_loaded,period_from,period_to,rows_read,rows_rejected,control_total) VALUES($1,$2,$3,$4,$5,$6,$7,'loaded',$8,$9,$10,$11,$12,$13) RETURNING id",
    [u.companyId, u.section, u.name, u.type, u.buf.length, sha(u.buf), u.buf, rows, sorted[0] ?? null, sorted.at(-1) ?? null, quality?.rowsRead ?? null, issues.filter((x) => !x.loaded).length, quality?.controlTotal ?? null]);
  if (issues.length) await c.query("INSERT INTO stg.rejected_rows(import_id,sheet,row_no,reason,loaded) SELECT $1,s,n,m,l FROM unnest($2::text[],$3::int[],$4::text[],$5::boolean[]) AS t(s,n,m,l)",
    [r.id, issues.map((x) => x.sheet), issues.map((x) => x.row), issues.map((x) => x.reason), issues.map((x) => x.loaded)]);
  return r.id;
}

/** All or nothing: the months in the file are replaced as a whole, every other month stays as it is. */
export const importFigures = (u: Upload, rows: FigureRow[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => period(r.year, r.month)))];
    const id = await addImport(c, u, rows.length, periods);
    await c.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period = ANY($3::date[]) AND branch_id IS NOT DISTINCT FROM $4", [u.companyId, u.section, periods, u.branchId ?? null]);
    for (const r of rows)
      await c.query("INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value,import_id,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [u.companyId, u.section, period(r.year, r.month), r.main, r.line, r.unit_type ?? "", r.value, id, u.branchId ?? null]);
  });

/** All or nothing, as one import: the months in the file are replaced for each branch of the company the file has a column for. */
export const importCogs = (u: Upload, rows: (CogsRow & { branchId: number | null })[], issues: ImportIssue[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => period(r.year, r.month)))];
    const id = await addImport(c, u, rows.length, periods, { rowsRead: rows.length, controlTotal: null, issues });
    for (const branchId of new Set(rows.map((r) => r.branchId)))
      await c.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section='cogs' AND period = ANY($2::date[]) AND branch_id IS NOT DISTINCT FROM $3", [u.companyId, periods, branchId]);
    for (const r of rows)
      await c.query("INSERT INTO app.company_figures(company_id,section,period,main,line,value,import_id,branch_id) VALUES($1,'cogs',$2,'COGS',$3,$4,$5,$6)", [u.companyId, period(r.year, r.month), r.line, r.value, id, r.branchId]);
  });

const DAILY = ["long_guests", "long_rate", "long_total", "short_guests", "short_rate", "short_total", "rooms_occupied", "room_revenue", "other_revenue", "rooms_available"] as const;

/** All or nothing: the months in the file are replaced as a whole (so a cleared day removes its old row), every other month stays as it is. */
export const importDaily = (u: Upload, rows: DailyRow[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => `${r.date.slice(0, 7)}-01`))];
    const id = await addImport(c, u, rows.length, periods);
    await c.query("DELETE FROM app.daily_sales WHERE company_id=$1 AND date_trunc('month', date)::date = ANY($2::date[]) AND branch_id IS NOT DISTINCT FROM $3", [u.companyId, periods, u.branchId ?? null]);
    for (const r of rows)
      await c.query(`INSERT INTO app.daily_sales(company_id,date,${DAILY.join(",")},import_id,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (company_id,(COALESCE(branch_id,0)),date) DO UPDATE SET ${DAILY.map((k) => `${k}=EXCLUDED.${k}`).join(",")},import_id=EXCLUDED.import_id,updated=now()`, [u.companyId, r.date, ...DAILY.map((k) => r[k]), id, u.branchId ?? null]);
  });

/** One figure typed by hand: no import, so import_id is cleared. When branchId is omitted (company-wide grid), any branch rows for that cell are replaced so they do not double-count. */
export function setFigure(companyId: number, section: string, year: number, month: number, main: string, line: string, unitType: string, value: number, branchId?: number | null) {
  if (!Number.isFinite(value)) throw new Error("Value must be a number.");
  if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error("Month must be 0-11.");
  const p = period(year, month), v = Math.round(value * 100) / 100;
  return numbering(async (c) => {
    if (branchId === undefined) await c.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period=$3 AND main=$4 AND line=$5 AND unit_type=$6 AND branch_id IS NOT NULL", [companyId, section, p, main, line, unitType]);
    await c.query(`INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value,branch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (company_id,(COALESCE(branch_id,0)),section,period,main,line,unit_type) DO UPDATE SET value=EXCLUDED.value, import_id=NULL, updated=now()`, [companyId, section, p, main, line, unitType, v, branchId ?? null]);
  });
}

export const deleteFigureMonth = (companyId: number, section: FigureSection, year: number, month: number, branchId: number | null = null) =>
  q("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period=$3 AND branch_id IS NOT DISTINCT FROM $4", [companyId, section, period(year, month), branchId]);

export const deleteFigureYear = (companyId: number, section: string, year: number, branchId?: number | null) =>
  q(`DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND ${inYear("period", "$3")} AND ($4::boolean OR branch_id IS NOT DISTINCT FROM $5)`, [companyId, section, year, branchId === undefined, branchId ?? null]);

export const deleteDailyYearRows = (companyId: number, year: number, branchId?: number | null) =>
  q(`DELETE FROM app.daily_sales WHERE company_id=$1 AND ${inYear("date", "$2")} AND ($3::boolean OR branch_id IS NOT DISTINCT FROM $4)`, [companyId, year, branchId === undefined, branchId ?? null]);

type ImportRow = { id: number; company: string; section: string; source: string; file_name: string; has_file: boolean; status: string; error: string | null; rows_loaded: number; period_from: string | null; period_to: string | null; created: string };
export const listImports = () =>
  q<ImportRow>(`SELECT i.id, c.name AS company, i.section, i.source, i.file_name, i.file IS NOT NULL AS has_file, i.status, i.error, i.rows_loaded,
      to_char(i.period_from,'Mon YYYY') AS period_from, to_char(i.period_to,'Mon YYYY') AS period_to, to_char(i.created AT TIME ZONE 'Asia/Qatar','YYYY-MM-DD HH24:MI') AS created
    FROM app.imports i JOIN app.companies c ON c.id=i.company_id ORDER BY i.id DESC LIMIT 100`);

export const getImportFile = (id: number) =>
  q1<{ file: Buffer | null; file_name: string }>("SELECT file, file_name FROM app.imports WHERE id=$1", [id]);

/** Latest month with takings for any branch of the company, as { year, month 0-11 }; null when nothing is uploaded. */
export const latestReceiptMonth = async (companyId: number) => {
  const row = await q1<{ year: number; month: number }>(`SELECT EXTRACT(year FROM max(date))::int AS year, EXTRACT(month FROM max(date))::int - 1 AS month FROM app.daily_receipts WHERE company_id=$1`, [companyId]);
  return row && row.year != null ? row : null;
};

/** One branch's takings for one month (month 0-11), a row per day and channel. */
export const listReceipts = (branchId: number, year: number, month: number) =>
  q<ReceiptRow>(`SELECT to_char(date,'YYYY-MM-DD') AS date, line, value::float8 AS value FROM app.daily_receipts WHERE branch_id=$1 AND date >= make_date($2::int,$3::int + 1,1) AND date < make_date($2::int,$3::int + 1,1) + interval '1 month'`, [branchId, year, month]);

/** All or nothing: the months in the file replace the same months of that branch (so a cleared cell or trailing day removes its old value), every other month stays as it is. */
export const importReceipts = (u: Upload & { branchId: number }, rows: ReceiptRow[], quality: ImportQuality) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => `${r.date.slice(0, 7)}-01`))];
    const id = await addImport(c, u, rows.length, periods, quality);
    await c.query("DELETE FROM app.daily_receipts WHERE branch_id=$1 AND date_trunc('month', date)::date = ANY($2::date[])", [u.branchId, periods]);
    await c.query(`INSERT INTO app.daily_receipts(company_id,branch_id,date,line,value,import_id) SELECT $1,$2,d,l,v,$6 FROM unnest($3::date[],$4::text[],$5::numeric[]) AS t(d,l,v)
      ON CONFLICT (branch_id,date,line) DO UPDATE SET value=EXCLUDED.value,import_id=EXCLUDED.import_id,updated=now()`,
      [u.companyId, u.branchId, rows.map((r) => r.date), rows.map((r) => r.line), rows.map((r) => r.value), id]);
  });
