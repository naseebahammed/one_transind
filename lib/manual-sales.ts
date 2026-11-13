import { readFileSync } from "node:fs";
import path from "node:path";

// code is the short department code stored in the sales table (its columns are short varchar); department is the name shown.
type ManualSale = { date: string; code: string; department: string; value: number; cost: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** Sales typed in by hand for departments the ERP does not carry (data/manual-sales.json). Bad rows throw, so a typo never reaches SQL. */
export function readManualSales(): ManualSale[] {
  const file = path.join(process.cwd(), "data", "manual-sales.json");
  const rows: ManualSale[] = JSON.parse(readFileSync(file, "utf8"));
  for (const r of rows) {
    if (!DATE.test(r.date) || !r.code?.trim() || !r.department?.trim() || !Number.isFinite(r.value) || !Number.isFinite(r.cost)) throw new Error(`Bad row in manual-sales.json: ${JSON.stringify(r)}`);
  }
  return rows;
}

/** FROM-clause source: the ERP sales table plus the hand-typed rows, one row each, with the same columns. Alias `s` is added by the caller. */
export function salesWithManual(table: string, rows: ManualSale[] = readManualSales()): string {
  if (!rows.length) return table;
  // json_populate_record fills a row of the table's own type, so every column keeps its real type and the rest stay NULL.
  const extra = rows.map((r) => `SELECT (json_populate_record(NULL::${table}, ${quote(JSON.stringify({ DOC_DATE: r.date, DOC_TYPE: "MAN", DEPT_CODE: r.code.trim(), NET_AMOUNT: r.value, NET_COST: r.cost }))})).*`);
  return `(SELECT * FROM ${table} UNION ALL ${extra.join(" UNION ALL ")})`;
}

/** FROM-clause source for department names: the ERP department list plus the manual departments' code and name. Alias is added by the caller. */
export function departmentsWithManual(rows: ManualSale[] = readManualSales()): string {
  const base = "public.invs_departments";
  if (!rows.length) return base;
  const values = [...new Map(rows.map((r) => [r.code.trim(), r.department.trim()]))].map(([code, name]) => `(${quote(code)}, ${quote(name)})`);
  return `(SELECT department_code, department_name FROM ${base} UNION ALL SELECT code::text, name::text FROM (VALUES ${values.join(", ")}) AS manual(code, name))`;
}
