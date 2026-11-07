import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { numbering, q } from "@/lib/db";
import type { DailyRow } from "@/lib/al-manzil";
import type { Figure, FigureSection } from "@/lib/company-data";

/** One uploaded file, kept with its import so it can be re-read or downloaded later. */
export type Upload = { companyId: number; section: string; name: string; type: string; buf: Buffer };
export type FigureRow = { year: number; month: number; main: string; line: string; unit_type?: string; value: number };

const period = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}-01`;
const inYear = (col: string, p: string) => `${col} >= make_date(${p}::int,1,1) AND ${col} < make_date(${p}::int + 1,1,1)`;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export const listFigures = (companyId: number, section: FigureSection, year: number) =>
  q<Figure>(`SELECT EXTRACT(year FROM period)::int AS year, EXTRACT(month FROM period)::int - 1 AS month, line, value::float8 AS value FROM app.company_figures WHERE company_id=$1 AND section=$2 AND ${inYear("period", "$3")}`, [companyId, section, year]);

/** Yearly expense total per company, for the company list. Costs are stored negative. */
export const listExpenseTotals = () =>
  q<{ company_id: number; year: number; value: number }>("SELECT company_id, EXTRACT(year FROM period)::int AS year, SUM(value)::float8 AS value FROM app.company_figures WHERE section='expenses' GROUP BY 1, 2");

/** Every monthly expense figure of every company, for the finance page. Costs are stored negative. */
export const listExpenses = () =>
  q<{ company_id: number; year: number; month: number; value: number }>("SELECT company_id, EXTRACT(year FROM period)::int AS year, EXTRACT(month FROM period)::int - 1 AS month, value::float8 AS value FROM app.company_figures WHERE section='expenses'");

/** Which months of a year each section has on file. A month is on file when it has rows, so a real zero counts. */
export async function listFilledMonths(companyId: number, year: number) {
  const out: Record<FigureSection | "pnl", Set<number>> = { pnl: new Set(), balance: new Set(), budget: new Set(), people: new Set(), expenses: new Set() };
  for (const r of await q<{ section: FigureSection | "pnl"; month: number }>(`SELECT DISTINCT section, EXTRACT(month FROM period)::int - 1 AS month FROM app.company_figures WHERE company_id=$1 AND ${inYear("period", "$2")}`, [companyId, year])) out[r.section]?.add(r.month);
  return out;
}

/** Group of each line in a section, from the chart. */
export const linesOf = async (section: string) => new Map((await q<{ main: string; sub: string }>("SELECT main, sub FROM app.accounts WHERE section=$1", [section])).map((a) => [a.sub, a.main]));

/** Keeps a refused file and the reason, so a failed upload is visible afterwards. */
export const recordRejected = (u: Upload, error: string) =>
  q("INSERT INTO app.imports(company_id,section,file_name,file_type,file_size,sha256,file,status,error) VALUES($1,$2,$3,$4,$5,$6,$7,'rejected',$8)", [u.companyId, u.section, u.name, u.type, u.buf.length, sha(u.buf), u.buf, error]);

async function addImport(c: PoolClient, u: Upload, rows: number, periods: string[]) {
  const sorted = [...periods].sort();
  const { rows: [r] } = await c.query<{ id: number }>("INSERT INTO app.imports(company_id,section,file_name,file_type,file_size,sha256,file,status,rows_loaded,period_from,period_to) VALUES($1,$2,$3,$4,$5,$6,$7,'loaded',$8,$9,$10) RETURNING id",
    [u.companyId, u.section, u.name, u.type, u.buf.length, sha(u.buf), u.buf, rows, sorted[0] ?? null, sorted.at(-1) ?? null]);
  return r.id;
}

/** All or nothing: the months in the file are replaced as a whole, every other month stays as it is. */
export const importFigures = (u: Upload, rows: FigureRow[]) =>
  numbering(async (c) => {
    const periods = [...new Set(rows.map((r) => period(r.year, r.month)))];
    const id = await addImport(c, u, rows.length, periods);
    await c.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period = ANY($3::date[])", [u.companyId, u.section, periods]);
    for (const r of rows)
      await c.query("INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value,import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [u.companyId, u.section, period(r.year, r.month), r.main, r.line, r.unit_type ?? "", r.value, id]);
  });

const DAILY = ["long_guests", "long_rate", "long_total", "short_guests", "short_rate", "short_total", "rooms_occupied", "room_revenue", "other_revenue", "rooms_available"] as const;

/** All or nothing: days in the file replace the same days, every other day stays as it is. */
export const importDaily = (u: Upload, rows: DailyRow[]) =>
  numbering(async (c) => {
    const id = await addImport(c, u, rows.length, rows.map((r) => `${r.date.slice(0, 7)}-01`));
    for (const r of rows)
      await c.query(`INSERT INTO app.daily_sales(company_id,date,${DAILY.join(",")},import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (company_id,date) DO UPDATE SET ${DAILY.map((k) => `${k}=EXCLUDED.${k}`).join(",")},import_id=EXCLUDED.import_id,updated=now()`, [u.companyId, r.date, ...DAILY.map((k) => r[k]), id]);
  });

/** One figure typed by hand: no import, so import_id is cleared. */
export function setFigure(companyId: number, section: string, year: number, month: number, main: string, line: string, unitType: string, value: number) {
  if (!Number.isFinite(value)) throw new Error("Value must be a number.");
  if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error("Month must be 0-11.");
  return q(`INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (company_id,section,period,main,line,unit_type) DO UPDATE SET value=EXCLUDED.value, import_id=NULL, updated=now()`, [companyId, section, period(year, month), main, line, unitType, Math.round(value * 100) / 100]);
}

export const deleteFigureMonth = (companyId: number, section: FigureSection, year: number, month: number) =>
  q("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period=$3", [companyId, section, period(year, month)]);

export const deleteFigureYear = (companyId: number, section: string, year: number) =>
  q(`DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND ${inYear("period", "$3")}`, [companyId, section, year]);

export const deleteDailyYearRows = (companyId: number, year: number) =>
  q(`DELETE FROM app.daily_sales WHERE company_id=$1 AND ${inYear("date", "$2")}`, [companyId, year]);

export type ImportRow = { id: number; company: string; section: string; source: string; file_name: string; has_file: boolean; status: string; error: string | null; rows_loaded: number; period_from: string | null; period_to: string | null; created: string };
export const listImports = () =>
  q<ImportRow>(`SELECT i.id, c.name AS company, i.section, i.source, i.file_name, i.file IS NOT NULL AS has_file, i.status, i.error, i.rows_loaded,
      to_char(i.period_from,'Mon YYYY') AS period_from, to_char(i.period_to,'Mon YYYY') AS period_to, to_char(i.created AT TIME ZONE 'Asia/Qatar','YYYY-MM-DD HH24:MI') AS created
    FROM app.imports i JOIN app.companies c ON c.id=i.company_id ORDER BY i.id DESC LIMIT 100`);
