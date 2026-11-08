// Reads point-in-time FMCG balances into rows: stock per item and warehouse (Stock Report) and salesmen's outstanding invoices (TC Outstanding).
// Pure (no database) so `node --test` can load it.
import type ExcelJS from "exceljs";

import { ERP_CODE, eachRow, findTable, text, type Item } from "./fmcg-masters.ts";
import { cellDate, num, type ImportIssue } from "./report-parsers.ts";

export type StockRow = { itemCode: string; location: string; qtyCurrent: number; qtyAllocated: number; qtyBalance: number; value: number };
export type Outstanding = { accountCode: string; accountName: string; postedDate: string; docCode: string | null; docNo: string; partyRef: string; department: string | null; balance: number };

const round = (v: number) => Math.round(v * 100) / 100;

/** "07-11-2026" in a file name, as a date. The Stock Report has its date only there. */
function dateInFileName(name: string) {
  const m = name.match(/(\d{2})-(\d{2})-(\d{4})/);
  const date = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  if (!m || isNaN(+new Date(`${date}T00:00:00Z`))) throw new Error(`"${name}" has no date like 08-11-2026 in its name, so the stock date is unknown. Keep the date in the file name.`);
  return date;
}

/** Stock from sheet DATA, or salesmen's outstanding invoices from sheet NEW. A batch split over several rows is added up per item and warehouse. */
export function balancesFromWorkbook(wb: ExcelJS.Workbook, fileName: string) {
  const issues: ImportIssue[] = [], stock = new Map<string, StockRow>(), items = new Map<string, Item>(), outstanding: Outstanding[] = [];
  let stockDate: string | null = null, stockTotal: number | null = null, outstandingDate: string | null = null, outstandingTotal: number | null = null;

  const stockTable = wb.worksheets.some((w) => w.name.trim() === "DATA") ? findTable(wb, "DATA", "ITEM_CODE", ["Location.", "Curr Qty.", "Alloc Qty.", "STOCK BALANCE -PCS", "COST", "Item Desc", "BRAND", "Packing.", "Size", "TYPE_OF_ITEM", "DEPARTMENT", "HEAD"]) : null;
  if (stockTable) {
    stockDate = dateInFileName(fileName);
    stockTable.ws.getRow(stockTable.head).eachCell((c) => { const v = typeof c.value === "object" && c.value && "result" in c.value ? c.value.result : c.value; if (typeof v === "number" && stockTotal === null) stockTotal = round(v); }); // the only number in the heading row is the sheet's total of STOCK BALANCE -PCS
    eachRow(stockTable, (cell, row, i) => {
      const itemCode = cell("ITEM_CODE");
      if (!itemCode) return;
      const location = cell("Location.");
      if (!ERP_CODE.test(itemCode) || !location) { issues.push({ sheet: stockTable.sheet, row: i, reason: `"${itemCode}" has no valid item code and warehouse.`, loaded: false }); return; }
      const figure = (h: string) => num(row.getCell(stockTable.column(h)).value, `DATA, row ${i}, ${h}`) ?? 0;
      let qtyCurrent, qtyAllocated, qtyBalance, cost;
      try {
        qtyCurrent = figure("Curr Qty."); qtyAllocated = figure("Alloc Qty."); qtyBalance = figure("STOCK BALANCE -PCS");
        const cell = row.getCell(stockTable.column("COST")).value, exact = typeof cell === "object" && cell && "result" in cell ? cell.result : cell;
        cost = typeof exact === "number" ? exact : figure("COST"); // unit costs carry five decimals (5.91858); rounding them first would change the stock value
      } catch (e) { issues.push({ sheet: stockTable.sheet, row: i, reason: (e as Error).message, loaded: false }); return; }
      const key = `${itemCode}|${location}`, earlier = stock.get(key);
      if (earlier) { earlier.qtyCurrent += qtyCurrent; earlier.qtyAllocated += qtyAllocated; earlier.qtyBalance += qtyBalance; earlier.value = round(earlier.value + qtyBalance * cost); }
      else stock.set(key, { itemCode, location, qtyCurrent, qtyAllocated, qtyBalance, value: round(qtyBalance * cost) });
      if (!items.has(itemCode)) items.set(itemCode, { code: itemCode, name: cell("Item Desc") || itemCode, brand: cell("BRAND").toUpperCase(), packing: cell("Packing.") || null, size: cell("Size") || null, itemType: cell("TYPE_OF_ITEM").replace(/ /g, "") || null, department: cell("DEPARTMENT") || null, manager: cell("HEAD") || null });
    });
    const sum = round([...stock.values()].reduce((s, r) => s + r.qtyBalance, 0));
    if (stockTotal !== null && Math.abs(sum - stockTotal) > 1) issues.push({ sheet: stockTable.sheet, row: stockTable.head, reason: `The stock balances add up to ${sum} but the sheet's total says ${stockTotal}.`, loaded: true });
  }

  const outstandingTable = wb.worksheets.some((w) => w.name.trim() === "NEW") ? findTable(wb, "NEW", "ACCOUNT_NUMBER", ["Account Name", "PSTNG_DATE1", "SLTR_DOC_CODE", "SLTR_OUR_DOC_NO", "SLTR_PTY_REF_NO", "FIN_DEPT"]) : null;
  if (outstandingTable) {
    let balanceColumn = 0;
    outstandingTable.ws.getRow(outstandingTable.head).eachCell((c, n) => { if (text(c.value).toLowerCase().startsWith("sum of balance")) balanceColumn = n; });
    if (!balanceColumn) throw new Error("NEW: no Sum of BALANCE column. The layout has changed.");
    eachRow(outstandingTable, (cell, row, i) => {
      const accountCode = cell("ACCOUNT_NUMBER"), first = text(row.getCell(1).value);
      let balance: number | null;
      try { balance = num(row.getCell(balanceColumn).value, `NEW, row ${i}`); } catch (e) { issues.push({ sheet: outstandingTable.sheet, row: i, reason: (e as Error).message, loaded: false }); return; }
      if (!accountCode) { if (first.toLowerCase() === "grand total") outstandingTotal = balance; return; }
      const postedDate = cellDate(row.getCell(outstandingTable.column("PSTNG_DATE1")).value, `NEW, row ${i}`), docNo = cell("SLTR_OUR_DOC_NO");
      if (!ERP_CODE.test(accountCode) || !postedDate || !docNo || balance === null) { issues.push({ sheet: outstandingTable.sheet, row: i, reason: `"${accountCode}" has no valid account, date, document or balance.`, loaded: false }); return; }
      outstanding.push({ accountCode, accountName: cell("Account Name"), postedDate, docCode: cell("SLTR_DOC_CODE") || null, docNo, partyRef: cell("SLTR_PTY_REF_NO"), department: cell("FIN_DEPT") || null, balance });
    });
    outstandingDate = outstanding.map((r) => r.postedDate).sort().at(-1) ?? null; // the report prints no date; nothing can be posted after the day it was run
    const sum = round(outstanding.reduce((s, r) => s + r.balance, 0));
    if (outstandingTotal !== null && Math.abs(sum - outstandingTotal) > 1) issues.push({ sheet: outstandingTable.sheet, row: outstandingTable.head, reason: `The balances add up to ${sum} but the sheet's total says ${outstandingTotal}.`, loaded: true });
  }

  const stockRows = [...stock.values()].map((r) => ({ ...r, qtyCurrent: round(r.qtyCurrent), qtyAllocated: round(r.qtyAllocated), qtyBalance: round(r.qtyBalance) }));
  return { stockDate, stock: stockRows, items: [...items.values()], stockTotal, outstandingDate, outstanding, outstandingTotal, issues, rowsRead: stockRows.length + outstanding.length };
}

export type Balances = ReturnType<typeof balancesFromWorkbook>;
