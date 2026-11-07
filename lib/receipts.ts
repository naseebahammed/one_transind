// Pure (type import only) so `node --test` can load it. Lays a branch's daily_receipts rows out as the "Daily Sales Deposit" sheet: a row per day, a column per channel, a totals row.
import type { ReceiptRow } from "./report-parsers.ts";

/** Column order of the sheet. Names are the workbook headings as receiptsFromWorkbook stores them. */
const RECEIPT_COLUMNS = ["Bank deposits", "Cash sales", "Credit card sales", "Talabat cash", "Talabat credit card", "Talabat discount", "Snoonu cash", "Rafeeq", "Snoonu", "Deliveroo", "Keeta"];
/** Cash banked is the same money as cash sales, so it stays out of gross sales. Every other column counts, discount columns included (checked against all 10 months of the Bin Omran sheet). */
const NOT_SALES = new Set(["Bank deposits"]);

type ReceiptDay = { day: number; values: Record<string, number>; gross: number | null }; // a channel with no entry = not submitted, kept apart from a real 0
type ReceiptTable = { columns: string[]; days: ReceiptDay[]; totals: Record<string, number>; gross: number };

/** Cash and card are the shop's own tills; everything else in gross sales (delivery apps and their discounts) is deliveryApps. days = days with figures. */
export function branchSummary(table: ReceiptTable) {
  const cash = table.totals["Cash sales"] ?? 0, card = table.totals["Credit card sales"] ?? 0;
  return { gross: table.gross, cash, card, deliveryApps: table.gross - cash - card, days: table.days.filter((d) => d.gross !== null).length };
}

export function receiptTable(rows: ReceiptRow[], year: number, month: number): ReceiptTable {
  const extra = [...new Set(rows.map((r) => r.line))].filter((l) => !RECEIPT_COLUMNS.includes(l)).sort(); // a channel added to the workbook later still shows
  const columns = [...RECEIPT_COLUMNS, ...extra];
  const days: ReceiptDay[] = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => ({ day: i + 1, values: {}, gross: null }));
  for (const r of rows) {
    const d = days[Number(r.date.slice(8, 10)) - 1];
    if (!d) continue;
    d.values[r.line] = r.value;
    if (!NOT_SALES.has(r.line)) d.gross = (d.gross ?? 0) + r.value;
  }
  const totals: Record<string, number> = {};
  for (const c of columns) totals[c] = days.reduce((s, d) => s + (d.values[c] ?? 0), 0);
  return { columns, days, totals, gross: days.reduce((s, d) => s + (d.gross ?? 0), 0) };
}
