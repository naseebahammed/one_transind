// Pure summary builders for the Company Finance admin page (no database connection required).
import { MONTHS, sum } from "./format.ts";
import { keyFor, plRows, report, years, type Reports } from "./reports.ts";

export type PnlSummary = { year: number; revenue: number[]; cost: number[]; net: number[]; costGroups: [string, number[]][] };
export type SalesSummary = { year: number; revenue: number };

/** Years on file for this company's P&L, each year's figures. Empty until a statement is uploaded for it. */
export function reportsFor(reports: Reports, c: { id: number }): PnlSummary[] {
  const key = keyFor(c);
  return years(reports, key).map((year) => {
    const r = report(reports, year, key);
    return { year, revenue: r.revenue, cost: r.totalCost, net: r.net, costGroups: r.costGroups };
  });
}

/** One row per year of the company's monthly sales grid (same shape as P&L), summed over the year. Empty until a report is uploaded. */
export function salesFor(reports: Reports, c: { id: number }): SalesSummary[] {
  const key = keyFor(c);
  // Every REVENUE line counts: hotels split room/other revenue, other sectors (e.g. Pavati) have a single "Sales" line.
  return years(reports, key, "sales").map((year) => ({
    year,
    revenue: sum(plRows(reports, year, key, "sales").filter((r) => r.main === "REVENUE").map((r) => sum(r.m))),
  }));
}

/** Total cost per cost group for each year across visible companies, sorted highest to lowest. */
export function costBreakdownByYear(entries: { c: { hidden: number }; r?: PnlSummary }[]) {
  const visible = entries.filter((x) => x.r && !x.c.hidden);
  return [...new Set(visible.map((x) => x.r!.year))].sort().map((year) => {
    const totals = new Map<string, number>();
    for (const { r } of visible.filter((x) => x.r!.year === year))
      for (const [name, d] of r!.costGroups) totals.set(name, (totals.get(name) ?? 0) + sum(d));
    const top = [...totals].sort((a, b) => b[1] - a[1]); // all lines, so the percentages are shares of total cost
    return { year, top };
  });
}

/** Expenses: one row per company and year with data; a month without a row stays null (not submitted). */
export function expenseRowsFor<C extends { id: number }>(companies: C[], expenses: { company_id: number; year: number; month: number; value: number }[]) {
  return companies.flatMap((c) => {
    const mine = expenses.filter((e) => e.company_id === c.id);
    return [...new Set(mine.map((e) => e.year))].sort().map((year) => ({
      c,
      year,
      m: MONTHS.map((_, i) => mine.find((e) => e.year === year && e.month === i)?.value ?? null),
    }));
  });
}

