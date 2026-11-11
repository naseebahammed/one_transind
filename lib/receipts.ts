// Pure (value/type imports from pure local modules only) so `node --test` can load it. Lays a branch's daily_receipts rows out as the "Daily Sales Deposit" sheet: a row per day, a column per channel, a totals row.
import { roundMoney, sumMoney } from "./money.ts";
import { BANK_DEPOSITS_LINE, isBankDepositLine, type ReceiptRow } from "./report-parsers.ts";

/** Column order of the sheet. Names are the workbook headings as receiptsFromWorkbook stores them. */
const RECEIPT_COLUMNS = [BANK_DEPOSITS_LINE, "Cash sales", "Credit card sales", "Talabat cash", "Talabat credit card", "Talabat discount", "Snoonu cash", "Rafeeq", "Snoonu", "Deliveroo", "Keeta"];

type ReceiptDay = { day: number; values: Record<string, number>; gross: number | null }; // a channel with no entry = not submitted, kept apart from a real 0
type ReceiptTable = { columns: string[]; days: ReceiptDay[]; totals: Record<string, number>; gross: number };

/** Cash and card are the shop's own tills; everything else in gross sales (delivery apps and their discounts) is deliveryApps. days = days with figures. */
export function branchSummary(table: ReceiptTable) {
  const cash = table.totals["Cash sales"] ?? 0, card = table.totals["Credit card sales"] ?? 0;
  return { gross: table.gross, cash, card, deliveryApps: roundMoney(table.gross - cash - card), days: table.days.filter((d) => d.gross !== null).length };
}

export function receiptTable(rows: ReceiptRow[], year: number, month: number): ReceiptTable {
  const canonicalLine = (line: string) => (isBankDepositLine(line) ? BANK_DEPOSITS_LINE : line);
  const extra = [...new Set(rows.map((r) => canonicalLine(r.line)))].filter((l) => !RECEIPT_COLUMNS.includes(l)).sort(); // a channel added to the workbook later still shows
  const columns = [...RECEIPT_COLUMNS, ...extra];
  const days: ReceiptDay[] = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => ({ day: i + 1, values: {}, gross: null }));
  for (const r of rows) {
    const d = days[Number(r.date.slice(8, 10)) - 1];
    if (!d) continue;
    const line = canonicalLine(r.line);
    d.values[line] = roundMoney((d.values[line] ?? 0) + r.value);
    if (!isBankDepositLine(line)) d.gross = roundMoney((d.gross ?? 0) + r.value);
  }
  const totals: Record<string, number> = {};
  for (const c of columns) totals[c] = sumMoney(days.map((d) => d.values[c] ?? 0));
  return { columns, days, totals, gross: sumMoney(days.map((d) => d.gross ?? 0)) };
}
