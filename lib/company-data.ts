// Pure (no imports) so `node --test` can load it. Rules for the company page's sections and their uploaded templates.
export type Section = "profile" | "pnl" | "balance" | "budget" | "people";
export type FigureSection = "balance" | "budget" | "people";
export type Cell = string | number | null;
export type Figure = { year: number; month: number; line: string; value: number };
export type MonthStatus = "Submitted" | "Not submitted" | "Not due";

export const SECTIONS: readonly (readonly [Section, string])[] = [["profile", "Profile"], ["pnl", "P&L"], ["balance", "Balance sheet and cash"], ["budget", "Budget"], ["people", "People"]];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AGES = ["current", "1-30 days", "31-60 days", "61-90 days", "over 90 days"];
const RECEIVABLES = AGES.map((a) => `Receivables: ${a}`), PAYABLES = AGES.map((a) => `Payables: ${a}`);
const ASSETS = ["Cash at bank", ...RECEIVABLES, "Stock", "Fixed assets", "Other assets"];
const FUNDING = [...PAYABLES, "Loan balance", "Other liabilities", "Equity"];
const WHOLE = ["Headcount", "Joiners", "Leavers"];

export const LINES: Record<FigureSection, readonly string[]> = {
  balance: [...ASSETS, ...FUNDING, "Loan repayments due in 12 months"],
  budget: ["Revenue", "Direct cost", "Overheads"],
  people: ["Headcount", "Payroll cost", "Joiners", "Leavers"],
};

export const isFigureSection = (s: string): s is FigureSection => s === "balance" || s === "budget" || s === "people";

const sectionName = (s: Section) => SECTIONS.find(([k]) => k === s)![1];
export const templateTitle = (company: string, section: FigureSection, year: number) => `${company} | ${sectionName(section)} | ${year}`;

/** Months after today's have not happened yet, so month-end actuals cannot exist for them. Budgets are set ahead. */
const isFuture = (year: number, month: number, today: Date) => year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const sum = (m: Map<string, number>, lines: string[]) => lines.reduce((s, l) => s + (m.get(l) ?? 0), 0);

/** Blank stays null, never 0: a missing figure and a typed zero mean different things. */
function readCell(c: Cell): number | null | "bad" {
  if (c === null || (typeof c === "string" && !c.trim())) return null;
  const v = typeof c === "number" ? c : Number(c.replaceAll(",", "").trim());
  return Number.isFinite(v) ? v : "bad";
}

/** Validates a whole uploaded grid and returns its figures, or the first problem found. Nothing is partly accepted. */
export function parseGrid(section: FigureSection, grid: Cell[][], expected: { company: string; year: number }, today: Date): { error: string } | { figures: Figure[] } {
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
      const v = readCell(rows.get(line)![month + 1] ?? null);
      if (v === null) continue;
      if (v === "bad") return { error: `${line}, ${name}: not a number.` };
      if (v < 0 && line !== "Cash at bank") return { error: `${line}, ${name}: cannot be negative.` };
      if (WHOLE.includes(line) && !Number.isInteger(v)) return { error: `${line}, ${name}: must be a whole number.` };
      values.set(line, v);
    }
    if (!values.size) continue;
    const blank = lines.filter((l) => !values.has(l));
    if (blank.length) return { error: `${name} is only partly filled. Missing: ${blank.join(", ")}.` };
    if (section !== "budget" && isFuture(year, month, today)) return { error: `${name} ${year} has not finished yet, so it cannot be submitted.` };
    if (section === "balance") {
      const gap = sum(values, ASSETS) - sum(values, FUNDING);
      if (Math.abs(gap) > 1) return { error: `${name}: the balance sheet is out by QAR ${Math.abs(Math.round(gap * 100) / 100)}. Assets must equal liabilities plus equity.` };
    }
    for (const [line, value] of values) figures.push({ year, month, line, value });
  }
  return figures.length ? { figures } : { error: "The file has no figures." };
}

/** Status of each month of a year, from the months on file. */
export function monthStatuses(section: "pnl" | FigureSection, year: number, filled: Set<number>, today: Date): MonthStatus[] {
  return MONTHS.map((_, m) => (filled.has(m) ? "Submitted" : section !== "budget" && isFuture(year, m, today) ? "Not due" : "Not submitted"));
}

/** Labels of the profile fields still blank. */
export function profileGaps(c: { legal_name: string; ownership_pct: number | null; started: string; erp_code: string; data_owner: string }) {
  return ([["Legal name", c.legal_name], ["Ownership %", c.ownership_pct], ["Start date", c.started], ["ERP code", c.erp_code], ["Data owner", c.data_owner]] as const)
    .filter(([, v]) => v === null || v === "").map(([l]) => l);
}
