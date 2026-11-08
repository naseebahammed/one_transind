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

test("outstanding: the date is the latest posting, the Grand Total is checked, a bad row is reported", () => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "NEW", [[0], ["SLTR_PTY_REF_NO", "ACCOUNT_NUMBER", "Account Name", "PSTNG_DATE1", "SLTR_DOC_CODE", "SLTR_OUR_DOC_NO", "LEDGER_CODE", "FIN_DEPT", "Sum of BALANCE_AMOUNT"],
    ["1019", "CS02588", "MOHAMED", new Date("2025-12-10T00:00:00Z"), "IN", "201/DT/1019", "01", "LB", 548.47], ["1020", "CS02588", "MOHAMED", new Date("2026-11-07T00:00:00Z"), "CN", "201/DT/1020", "01", "NF", -48.47], ["1021", "CS02588", "MOHAMED", "not a date", "IN", "201/DT/1021", "01", "LB", 5], ["Grand Total", null, null, null, null, null, null, null, 500]]);
  const b = balancesFromWorkbook(wb, "TC outstanding _2026.xlsx");
  assert.equal(b.outstandingDate, "2026-11-07");
  assert.equal(b.outstandingTotal, 500);
  assert.deepEqual(b.outstanding.map((r) => [r.docNo, r.postedDate, r.balance]), [["201/DT/1019", "2025-12-10", 548.47], ["201/DT/1020", "2026-11-07", -48.47]]);
  assert.equal(b.issues.length, 1);
  assert.equal(b.issues[0].loaded, false);
});

test("a workbook with neither sheet gives nothing", () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Sheet1");
  assert.equal(balancesFromWorkbook(wb, "x.xlsx").rowsRead, 0);
});
