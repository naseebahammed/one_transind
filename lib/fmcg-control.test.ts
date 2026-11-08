import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { controlFromWorkbook } from "./fmcg-control.ts";

function sheet(wb: ExcelJS.Workbook, name: string, rows: unknown[][]) {
  const ws = wb.addWorksheet(name);
  rows.forEach((r, i) => r.forEach((v, n) => { ws.getCell(1 + i, 1 + n).value = v as ExcelJS.CellValue; }));
}

test("variance: dd/mm/yyyy dates are read, figures stay as printed, a row with no date is reported", () => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "Data", [["DO Date", "DO No", "Customer Code", "Customer", "Salesman", "LOC Code", "Store In Charge", "Driver", "Item Code", "Item Desc", "Qty (RV)", "Qty (DO)", "Qty Variance", "Invoice Amount(RV)", "Invoice Amount(DO)", "Value Variance", "BRAND", "S&B", "Manager", "Supervisors"],
    ["01/11/2026", "636359", "C214668", "RAMEZ", "SANJEEV", "L05", "ANTON", "173-RAVI", "003000230", "KDD JUICE", 120, 0, 120, 243.6, 0, 243.6, "KDD", "x", "SAJID - MT", "IQBAL"], ["", "636360", "", "", "", "L05", "", "", "003000231", "", 1, 0, 1, 2, 0, 2, "KDD", "", "", ""]]);
  const c = controlFromWorkbook(wb);
  assert.deepEqual(c.variances.map((v) => [v.doDate, v.doNo, v.itemCode, v.qtyRv, v.qtyDo, v.valueRv]), [["2026-11-01", "636359", "003000230", 120, 0, 243.6]]);
  assert.equal(c.issues.length, 1);
  assert.equal(c.issues[0].loaded, false);
});

test("consignment: found on a sheet called Sheet2, blank invoice dates stay blank, repeated batches each keep a line", () => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "Sheet2", [["CS Recvd Date.", "Supplier", "INVOICE_DATE", "Order No.", "CS No", "Invoice No.", "Store Loc", "Item Code.", "Item Description.", "Size", "Packing.", "Expiry Date", "EXCISE_TAX_Y_N", "BILL_QTY", "RECVD_QTY"],
    [new Date("2026-11-07T00:00:00Z"), "KDD", new Date("2026-10-29T00:00:00Z"), 20163, 25240, "2026\\427", "L14", "003000051", "PASTE", "135 GM", "1X5X8", new Date("2027-10-19T00:00:00Z"), "N", 4032, 4031],
    [new Date("2026-11-07T00:00:00Z"), "KDD", null, 20163, 25240, "2026\\427", "L14", "003000051", "PASTE", "135 GM", "1X5X8", new Date("2027-10-19T00:00:00Z"), "N", 10, 10]]);
  const c = controlFromWorkbook(wb);
  assert.deepEqual(c.consignments.map((x) => [x.consignmentNo, x.invoiceDate, x.billedQty, x.receivedQty, x.lineNo]), [["25240", "2026-10-29", 4032, 4031, 2], ["25240", null, 10, 10, 3]]);
});

const expiryBook = (total: number, category: boolean) => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "Summary", [["Sum of Total cost"]]);
  const head = ["SL#", "ITEM CODE", "DESCRIPTION", "SIZE", "PACKING", "BRAND", ...(category ? ["CATEGORY"] : []), "LOCATION2", "CTN", "OTR", "PCS", "Total cost", "Expiry Date", "Remaining Days", "REMARKS"];
  const gap = category ? [null] : [];
  sheet(wb, "01-11-2026", [["FNB- AGEING REPORT AS OF"], [null, null, null, null, null, null, ...gap, new Date("2026-11-01T00:00:00Z"), null, null, null, total], head,
    ["01", "003000099", "KDD SAUCE", "500ML", "1X12", "KDD", ...(category ? ["OTHER"] : []), "L05", 10, null, 3, 578.12, new Date("2026-11-10T00:00:00Z"), 9, null],
    ["02", "442000092", "DARINA", "2.5 KG", "1X6", "MEPTICO", ...(category ? ["B"] : []), "L05", null, null, 4, 83.77, new Date("2026-11-12T00:00:00Z"), 11, "MARKET RETURN"]]);
  return wb;
};

test("expiry ageing: date, department and total come from above the headings; the category column is optional", () => {
  const c = controlFromWorkbook(expiryBook(661.89, true));
  assert.equal(c.expiryDate, "2026-11-01");
  assert.equal(c.expiryReport, "FNB");
  assert.equal(c.expiry.length, 2);
  assert.deepEqual([c.expiry[0].category, c.expiry[0].cartons, c.expiry[0].outers, c.expiry[0].pieces, c.expiry[1].remarks], ["OTHER", 10, null, 3, "MARKET RETURN"]);
  assert.equal(c.issues.length, 0);
  assert.equal(controlFromWorkbook(expiryBook(661.89, false)).expiry[0].category, null);
  assert.match(controlFromWorkbook(expiryBook(999, true)).issues[0].reason, /add up to 661.89 but the sheet's total says 999/);
});

test("a workbook with none of these gives nothing", () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Sheet1");
  assert.equal(controlFromWorkbook(wb).rowsRead, 0);
});
