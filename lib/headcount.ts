import { readFileSync } from "node:fs";
import path from "node:path";

type HeadcountRow = { month: string; department: string; company: string; count: number };

const MONTH = /^\d{4}-\d{2}$/;

/** Monthly department headcount from the HR department files (data/headcount.json). Bad rows throw, so a typo never shows up as a number. */
export function readHeadcount(): HeadcountRow[] {
  const file = path.join(process.cwd(), "data", "headcount.json");
  const rows: HeadcountRow[] = JSON.parse(readFileSync(file, "utf8"));
  for (const r of rows) {
    if (!MONTH.test(r.month) || !r.department?.trim() || !r.company?.trim() || !Number.isInteger(r.count) || r.count < 0) throw new Error(`Bad row in headcount.json: ${JSON.stringify(r)}`);
  }
  return rows;
}

/** Everyone in the latest month on file, all departments (linked to a company or not). Null when the file is empty. */
export function latestHeadcount(rows: HeadcountRow[] = readHeadcount()): { month: string; total: number } | null {
  const month = rows.reduce((latest, r) => (r.month > latest ? r.month : latest), "");
  return month ? { month, total: rows.filter((r) => r.month === month).reduce((sum, r) => sum + r.count, 0) } : null;
}

/** The latest month's counts as [name, count] lists, biggest first: one per company, and a department list for each company. */
export function headcountByCompany(rows: HeadcountRow[] = readHeadcount()) {
  const latest = latestHeadcount(rows);
  const companies = new Map<string, number>(), departments = new Map<string, Map<string, number>>();
  for (const r of rows.filter((x) => x.month === latest?.month)) {
    companies.set(r.company, (companies.get(r.company) ?? 0) + r.count);
    const inCompany = departments.get(r.company) ?? new Map<string, number>();
    inCompany.set(r.department, (inCompany.get(r.department) ?? 0) + r.count);
    departments.set(r.company, inCompany);
  }
  const sorted = (counts: Map<string, number>) => [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  return { companies, departments: (company: string) => sorted(departments.get(company) ?? new Map()) };
}
