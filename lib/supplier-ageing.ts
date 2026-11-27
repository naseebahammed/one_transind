// Reads the Supplier Ageing Report (a pivot export): one row per supplier account, amounts split into age buckets. Amounts in QAR.
// Pure (no database) so `node --test` can load it. Sign is kept as the ERP gives it; the sheet's Grand Total column is ignored and recomputed, so a stale pivot total cannot load.
import { roundMoney, sumMoney } from "./money.ts";

export type SupplierAgeing = {
  accountNo: string;
  name: string;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days91To120: number;
  days121To180: number;
  days181To360: number;
  overOneYear: number;
  total: number;
};

const BUCKETS = ["1-30", "31-60", "61-90", "91-120", "121-180", "181-360", "above 1yr"] as const;
const FIELDS = ["days1To30", "days31To60", "days61To90", "days91To120", "days121To180", "days181To360", "overOneYear"] as const;

const cellText = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim();

/** A number cell, or 0 when blank or an Excel error such as #N/A (the pivot prints those for empty accounts). Any other text refuses the file. */
function amount(c: unknown, where: string): number {
  if (typeof c === "number") return roundMoney(c);
  const t = cellText(c);
  if (!t || t.startsWith("#")) return 0;
  const parsed = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) throw new Error(`${where}: "${t}" is not a number.`);
  return roundMoney(parsed);
}

export function parseSupplierAgeing(grid: unknown[][]): { rows: SupplierAgeing[]; errors: string[] } {
  const head = grid.findIndex((r) => cellText(r[0]).toLowerCase() === "account no" && cellText(r[1]).toLowerCase() === "account name");
  if (head < 0) return { rows: [], errors: ["No 'Account No' / 'Account Name' header row found."] };
  const columns = BUCKETS.map((b) => grid[head].findIndex((c) => cellText(c).toLowerCase() === b));
  const missing = BUCKETS.filter((_, i) => columns[i] < 0);
  if (missing.length) return { rows: [], errors: [`Missing age columns: ${missing.join(", ")}.`] };

  const rows: SupplierAgeing[] = [], errors: string[] = [], seen = new Set<string>();
  for (let i = head + 1; i < grid.length; i++) {
    const accountNo = cellText(grid[i][0]);
    if (!accountNo || /^grand total$/i.test(accountNo)) continue;
    try {
      if (seen.has(accountNo)) throw new Error(`Row ${i + 1}: account ${accountNo} appears twice.`);
      seen.add(accountNo);
      const values = columns.map((col, n) => amount(grid[i][col], `Row ${i + 1} (${BUCKETS[n]})`));
      const row = { accountNo, name: cellText(grid[i][1]) } as SupplierAgeing;
      FIELDS.forEach((field, n) => { row[field] = values[n]; });
      row.total = sumMoney(values);
      rows.push(row);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { rows, errors };
}
