import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { balancesFromWorkbook } from "./fmcg-balances.ts";

function sheet(wb: ExcelJS.Workbook, name: string, rows: unknown[][]) {
  const ws = wb.addWorksheet(name);
  rows.forEach((r, i) => r.forEach((v, n) => { ws.getCell(1 + i, 1 + n).value = v as ExcelJS.CellValue; }));
}
const stockHead = ["ITEM_CODE", "Location.", "Curr Qty.", "Alloc Qty.", "STOCK BALANCE -PCS", "COST", "Item Desc", "BRAND", "Packing.", "Size", "TYPE_OF_ITEM", "DEPARTMENT", "HEAD"];
const stockBook = (total: number) => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "DATA", [[...stockHead, total], ["204000001", "L04", 536, 10, 526, 45.5, "VANILLA", "kdd", "1X4", "2 LTR", "S PROMO", "FNB", "SAJID"], ["204000001", "L04", 41, 0, 41, 45.5, "VANILLA", "kdd", "1X4", "2 LTR", "S PROMO", "FNB", "SAJID"], ["204000001", "L05", 3, 0, 3, 45.5, "VANILLA", "kdd", "1X4", "2 LTR", "S PROMO", "FNB", "SAJID"]]);
  return wb;
};

test("stock: split batches add up per item and warehouse, the date comes from the file name", () => {
  const b = balancesFromWorkbook(stockBook(570), "STOCK REPORT - 08-11-2026.xlsx");
  assert.equal(b.stockDate, "2026-11-08");
  assert.deepEqual(b.stock.map((r) => [r.itemCode, r.location, r.qtyCurrent, r.qtyAllocated, r.qtyBalance, r.value]), [["204000001", "L04", 577, 10, 567, 25798.5], ["204000001", "L05", 3, 0, 3, 136.5]]);
  assert.equal(b.items[0].brand, "KDD");
  assert.equal(b.items[0].itemType, "SPROMO");
  assert.equal(b.issues.length, 0);
});

test("stock: a total that disagrees is flagged, and a file name with no date refuses the file", () => {
  assert.match(balancesFromWorkbook(stockBook(999), "STOCK 08-11-2026.xlsx").issues[0].reason, /add up to 570 but the sheet's total says 999/);
  assert.throws(() => balancesFromWorkbook(stockBook(570), "stock.xlsx"), /no date like/);
});

test("a workbook with neither sheet gives nothing", () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Sheet1");
  assert.equal(balancesFromWorkbook(wb, "x.xlsx").rowsRead, 0);
});
