// Reads a logistics profitability workbook (one sheet per month, one row per invoice) into monthly totals per business line. Amounts in QAR.
// Pure (no database) so `node --test` can load it. The sheets' layouts differ month to month, so columns are found by heading, and the sheet's own total and margin cells are ignored:
// sales and cost are added up from the invoice rows, and margin is sales minus cost.
import { roundMoney, sumMoney } from "./money.ts";

export type ProfitabilityMonth = { line: string; month: number; sales: number; cost: number; invoices: number };

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const KUWAIT_LINE = "Kuwait logistics";
/** The lines a file can be uploaded for. A sheet with KWT in its name is booked to the Kuwait line instead. */
export const PROFITABILITY_LINES = ["Clearing - external customers", "Clearing - group companies", "Trucking freight"] as const;

const cellText = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim();
const isSales = (h: string) => /^(sales|total inv)/.test(h);
const isCost = (h: string) => /^(cost|total cost|amount)$/.test(h);

/** Monthly totals of every sheet. A sheet with no month in its name or no sales and cost headings refuses the whole file, so nothing half-loads. */
export function parseProfitability(sheets: { name: string; grid: unknown[][] }[], line: string): { rows: ProfitabilityMonth[]; errors: string[] } {
  const rows: ProfitabilityMonth[] = [], errors: string[] = [], seen = new Set<string>();
  for (const { name, grid } of sheets) {
    const month = MONTH_NAMES.indexOf(name.trim().slice(0, 3).toLowerCase()) + 1;
    if (!month) { errors.push(`Sheet "${name.trim()}": no month at the start of the sheet name.`); continue; }
    let head = -1, salesColumn = -1, costColumn = -1;
    for (let i = 0; i < Math.min(grid.length, 8) && head < 0; i++) {
      const headings = grid[i].map((c) => cellText(c).toLowerCase());
      salesColumn = headings.findIndex(isSales); costColumn = headings.findIndex(isCost);
      if (salesColumn >= 0 && costColumn >= 0) head = i;
    }
    if (head < 0) { errors.push(`Sheet "${name.trim()}": no Sales and Cost headings found.`); continue; }
    const sheetLine = /kwt/i.test(name) ? KUWAIT_LINE : line, key = `${sheetLine}|${month}`;
    if (seen.has(key)) { errors.push(`Sheet "${name.trim()}": ${sheetLine} already has a sheet for that month.`); continue; }
    seen.add(key);
    const sales: number[] = [], cost: number[] = [];
    for (const row of grid.slice(head + 1)) {
      const amount = row[salesColumn];
      // Only cells left of Sales count as the label (invoice, date, customer): a total row has none, or says Total, and may hold stray text further right.
      const label = row.slice(0, salesColumn).filter((c): c is string => typeof c === "string" && c.trim() !== "");
      if (typeof amount !== "number" || !label.length || label.some((c) => /^total\b/i.test(c.trim()))) continue;
      sales.push(amount); cost.push(typeof row[costColumn] === "number" ? (row[costColumn] as number) : 0);
    }
    rows.push({ line: sheetLine, month, sales: roundMoney(sumMoney(sales)), cost: roundMoney(sumMoney(cost)), invoices: sales.length });
  }
  return { rows, errors };
}
