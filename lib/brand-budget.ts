// Reads the Trading & Distribution budget workbooks: the yearly brand plan ("<year> Brand Index" sheet) and the monthly plan by manager, brand and group (the sheet named after the year). Amounts in QAR.
// Pure (no database) so `node --test` can load it. Columns are found by heading. A blank month is left out (not submitted); a 0 is kept as a real zero.
// Cost of goods is stored negative, like every cost in the app.
import { roundMoney } from "./money.ts";

export type BrandYearPlan = { brand: string; priorActual: number | null; forecast: number | null; target: number; cogs: number | null; rebate: number | null; secondary: number | null; supplier: number | null };
export type BrandMonthPlan = { manager: string; brand: string; productGroup: string; month: number; amount: number };

const cellText = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim();
const amountOrNull = (c: unknown) => (typeof c === "number" && Number.isFinite(c) ? roundMoney(c) : null);
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The yearly brand plan for `year`. Total, subtotal and blank rows are left out; every other row with a target is a plan line. */
export function parseBrandYearPlan(grid: unknown[][], year: number): { rows: BrandYearPlan[]; errors: string[] } {
  const head = grid.findIndex((r) => r.some((c) => cellText(c).toLowerCase() === `${year} target`));
  if (head < 0) return { rows: [], errors: [`No "${year} target" column found. Is this the ${year} brand plan?`] };
  const find = (pattern: RegExp) => grid[head].findIndex((c) => pattern.test(cellText(c).toLowerCase()));
  const target = find(new RegExp(`^${year} target$`)), prior = find(new RegExp(`^${year - 2} actual$`)), forecast = find(new RegExp(`^${year - 1} fc$`));
  const cogs = find(/^cogs$/), rebate = find(new RegExp(`^${year} rebate$`)), secondary = find(new RegExp(`^${year} secondary`)), supplier = find(new RegExp(`^${year} supplier`));
  const rows: BrandYearPlan[] = [], errors: string[] = [], seen = new Set<string>();
  for (const row of grid.slice(head + 1)) {
    const brand = cellText(row[0]), value = amountOrNull(row[target]);
    if (!brand || /^total\b/i.test(brand) || value === null) continue;
    if (seen.has(brand)) { errors.push(`Brand "${brand}" appears twice.`); continue; }
    seen.add(brand);
    const at = (column: number) => (column < 0 ? null : amountOrNull(row[column]));
    const cost = at(cogs);
    rows.push({ brand, priorActual: at(prior), forecast: at(forecast), target: value, cogs: cost === null ? null : -Math.abs(cost), rebate: at(rebate), secondary: at(secondary), supplier: at(supplier) });
  }
  return { rows, errors };
}

/** The monthly plan: one row per manager (may be blank for new items), brand and group, with a number per month. Rows without a brand and group are totals and are left out. */
export function parseBrandMonthPlan(grid: unknown[][]): { rows: BrandMonthPlan[]; errors: string[] } {
  const head = grid.findIndex((r) => cellText(r[1]).toLowerCase().startsWith("brand") && cellText(r[2]).toLowerCase() === "group");
  if (head < 0) return { rows: [], errors: ["No Manager / Brand / Group header row found."] };
  const columns = MONTHS.map((m) => grid[head].findIndex((c) => cellText(c).toLowerCase() === m));
  if (columns.some((c) => c < 0)) return { rows: [], errors: ["The header row needs Jan to Dec columns."] };
  const rows: BrandMonthPlan[] = [], errors: string[] = [], seen = new Set<string>();
  grid.slice(head + 1).forEach((row, i) => {
    const manager = cellText(row[0]), brand = cellText(row[1]), productGroup = cellText(row[2]);
    if (!brand || !productGroup) return;
    const key = `${manager}|${brand}|${productGroup}`;
    if (seen.has(key)) { errors.push(`Row ${head + i + 2}: ${brand} / ${productGroup} appears twice.`); return; }
    seen.add(key);
    columns.forEach((column, m) => {
      const amount = amountOrNull(row[column]);
      if (amount !== null) rows.push({ manager, brand, productGroup, month: m + 1, amount });
    });
  });
  return { rows, errors };
}
