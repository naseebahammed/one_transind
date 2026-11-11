// Pure (only the import-free ./format.ts) so `node --test` can load it. Rules for the company page's sections and their uploaded templates.
export type Section = "profile" | "pnl" | "budget" | "people" | "expenses" | "daily";
export type FigureSection = "budget" | "people" | "expenses";
export type GridSection = FigureSection | "sales"; // same one-year grid; sales is stored in the company's sales file, not the figures table
export type Cell = string | number | null;
export type Figure = { year: number; month: number; line: string; value: number };
export type MonthStatus = "Submitted" | "Not submitted" | "Not due";

export const SECTIONS: readonly (readonly [Section, string])[] = [["profile", "Profile"], ["pnl", "P&L"], ["budget", "Budget"], ["people", "People"], ["expenses", "Expenses"], ["daily", "Daily sales"]]; // daily: restaurants with branches only, the page hides it elsewhere

import { MONTHS } from "./format.ts";
import { isValidFigureAmount } from "./input-validation.ts";
import { parseMoneyString, roundMoney } from "./money.ts";

export { MONTHS };
const WHOLE = ["Headcount", "Joiners", "Leavers"];

export const LINES: Record<GridSection, readonly string[]> = {
  budget: ["Revenue", "Direct cost", "Overheads"],
  people: ["Headcount", "Payroll cost", "Joiners", "Leavers"],
  expenses: ["Expenses"],
  sales: ["Sales"],
};

export const isFigureSection = (s: string): s is FigureSection => s === "budget" || s === "people" || s === "expenses";

export const sectionName = (s: Section | "sales") => (s === "sales" ? "Monthly sales" : SECTIONS.find(([k]) => k === s)![1]);
export const templateTitle = (company: string, section: GridSection, year: number) => `${company} | ${sectionName(section)} | ${year}`;

/** Months after today's have not happened yet, so month-end actuals cannot exist for them. Budgets are set ahead. */
const isFuture = (year: number, month: number, today: Date) => year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Checks one cell's number against its line's rules; returns the problem or null. */
export function checkFigureCell(line: string, v: number): string | null {
  if (!Number.isFinite(v)) return "not a number.";
  if (!isValidFigureAmount(v)) return "amount exceeds the maximum allowed.";
  if (v < 0) return "cannot be negative.";
  if (WHOLE.includes(line) && !Number.isInteger(v)) return "must be a whole number.";
  return null;
}

/** Blank stays null, never 0: a missing figure and a typed zero mean different things. */
function readCell(c: Cell, whole = false): number | null | "bad" {
  if (c === null || (typeof c === "string" && !c.trim())) return null;
  if (typeof c === "number") {
    if (!Number.isFinite(c)) return "bad";
    return whole && !Number.isInteger(c) ? c : roundMoney(c);
  }
  const raw = Number(c.replaceAll(",", "").trim());
  if (whole) return Number.isFinite(raw) ? raw : "bad";
  return parseMoneyString(c) ?? "bad";
}

/** Validates a whole uploaded grid and returns its figures, or the first problem found. Nothing is partly accepted. */
export function parseGrid(section: GridSection, grid: Cell[][], expected: { company: string; year: number }, today: Date): { error: string } | { figures: Figure[] } {
  const { company, year } = expected, lines = LINES[section];
  const wanted = templateTitle(company, section, year);
  if (!same(String(grid[0]?.[0] ?? ""), wanted)) return { error: `This file is not the template for "${wanted}". Download that template and try again.` };
  if (!MONTHS.every((m, i) => same(String(grid[1]?.[i + 1] ?? ""), m))) return { error: "The month headers (Jan to Dec) were changed. Use the template as downloaded." };

  const rows = new Map<string, Cell[]>();
  for (const row of grid.slice(2)) {
    const line = String(row[0] ?? "").trim();
    if (!line) continue;
    if (!lines.includes(line)) return { error: `"${line}" is not a line in this template.` };
    if (rows.has(line)) return { error: `"${line}" appears more than once.` };
    rows.set(line, row);
  }
  const missing = lines.find((l) => !rows.has(l));
  if (missing) return { error: `"${missing}" is missing from the file.` };

  const figures: Figure[] = [];
  for (let month = 0; month < 12; month++) {
    const name = MONTHS[month], values = new Map<string, number>();
    for (const line of lines) {
      const v = readCell(rows.get(line)![month + 1] ?? null, WHOLE.includes(line));
      if (v === null) continue;
      if (v === "bad") return { error: `${line}, ${name}: not a number.` };
      const problem = checkFigureCell(line, v);
      if (problem) return { error: `${line}, ${name}: ${problem}` };
      values.set(line, v);
    }
    if (!values.size) continue;
    const blank = lines.filter((l) => !values.has(l));
    if (blank.length) return { error: `${name} is only partly filled. Missing: ${blank.join(", ")}.` };
    if (section !== "budget" && isFuture(year, month, today)) return { error: `${name} ${year} has not finished yet, so it cannot be submitted.` };
    for (const [line, value] of values) figures.push({ year, month, line, value });
  }
  return figures.length ? { figures } : { error: "The file has no figures." };
}

/** The month a template is for: what was chosen, with last month filling any gap. Null when the choice is invalid. */
export function templatePeriod(year: string | null, month: string | null, today: Date) {
  const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const y = year ? Number(year) : month ? today.getFullYear() : last.getFullYear(), m = month ? Number(month) : last.getMonth();
  return Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 0 && m <= 11 ? { year: y, month: m } : null;
}

/** Status of each month of a year, from the months on file. */
export function monthStatuses(section: "pnl" | FigureSection, year: number, filled: Set<number>, today: Date): MonthStatus[] {
  return MONTHS.map((_, m) => (filled.has(m) ? "Submitted" : section !== "budget" && isFuture(year, m, today) ? "Not due" : "Not submitted"));
}

/** Labels of the profile fields still blank. */
export function profileGaps(c: { erp_code: string }) {
  return c.erp_code ? [] : ["ERP code"];
}
