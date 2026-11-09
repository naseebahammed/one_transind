// Reads point-in-time FMCG balances into rows: stock per item and warehouse (Stock Report) .
// Pure (no database) so `node --test` can load it.
import type ExcelJS from "exceljs";

import { ERP_CODE, eachRow, findTable, text, type Item } from "./fmcg-masters.ts";
import { cellDate, num, type ImportIssue } from "./report-parsers.ts";

export type StockRow = { itemCode: string; location: string; qtyCurrent: number; qtyAllocated: number; qtyBalance: number; value: number };

const round = (v: number) => Math.round(v * 100) / 100;

/** "07-11-2026" in a file name, as a date. The Stock Report has its date only there. */
function dateInFileName(name: string) {
  const m = name.match(/(\d{2})-(\d{2})-(\d{4})/);
  const date = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  if (!m || isNaN(+new Date(`${date}T00:00:00Z`))) throw new Error(`"${name}" has no date like 08-11-2026 in its name, so the stock date is unknown. Keep the date in the file name.`);
  return date;
}

/** Stock from sheet DATA. A batch split over several rows is added up per item and warehouse. */
export function balancesFromWorkbook(wb: ExcelJS.Workbook, fileName: string) {
  const issues: ImportIssue[] = [], stock = new Map<string, StockRow>(), items = new Map<string, Item>();
  let stockDate: string | null = null, stockTotal: number | null = null;

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


  const stockRows = [...stock.values()].map((r) => ({ ...r, qtyCurrent: round(r.qtyCurrent), qtyAllocated: round(r.qtyAllocated), qtyBalance: round(r.qtyBalance) }));
  return { stockDate, stock: stockRows, items: [...items.values()], stockTotal, issues, rowsRead: stockRows.length };
}

export type Balances = ReturnType<typeof balancesFromWorkbook>;
