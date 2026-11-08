import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { mastersFromWorkbook } from "./fmcg-masters.ts";

function sheet(wb: ExcelJS.Workbook, name: string, rows: unknown[][], firstRow = 1) {
  const ws = wb.addWorksheet(name);
  rows.forEach((r, i) => r.forEach((v, n) => { ws.getCell(firstRow + i, 1 + n).value = v as ExcelJS.CellValue; }));
}

const targetBook = (monthHeading: string, targetHeading: string, total: number) => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "MANAGER WISE", [[monthHeading], ["MANAGER", "TARGET", "SALE"], ["SAJID", 100, 5], ["RAYMOND", 50, 2], ["TOTAL", 150, 7]]);
  sheet(wb, "SALESMAN WISE DSR", [["DAYS", 26], ["SM CODE", "SMAN_NAME", "SUPERVISOR NAME", "BRAND", "CHANNEL", "DEPT", targetHeading],
    [28, "ALI", "IQBAL&SHEREEF", "kdd", "SAJID - MT", "FNB", 40], ["028", "ALI", "IQBAL & SHEREEF", "LUNA", "SAJID - MT", "FNB", 0], [454, "OMAR", "NOUSHAD", "KDD", "SALEEM - GT", "FNB", null], [null, null, null, null, null, null, total]]);
  return wb;
};

test("targets: codes are padded, spellings joined, a blank target stays blank and a zero stays zero", () => {
  const m = mastersFromWorkbook(targetBook("2026-NOVEMBER -RV SALE", "NOV TARGET", 40));
  assert.equal(m.period, "2026-11-01");
  assert.deepEqual(m.assignments.map((a) => [a.salesmanCode, a.brand, a.supervisor, a.target]), [["028", "KDD", "IQBAL & SHEREEF", 40], ["028", "LUNA", "IQBAL & SHEREEF", 0], ["454", "KDD", "NOUSHAD", null]]);
  assert.deepEqual(m.managerTargets, [{ manager: "SAJID", target: 100 }, { manager: "RAYMOND", target: 50 }]);
  assert.equal(m.controlTotal, 40);
  assert.equal(m.issues.length, 0);
  assert.deepEqual(m.brands.map((b) => b.code).sort(), ["KDD", "LUNA"]);
});

test("targets: a total that disagrees is flagged, and a target column for another month refuses the file", () => {
  assert.match(mastersFromWorkbook(targetBook("2026-NOVEMBER -RV SALE", "NOV TARGET", 99)).issues[0].reason, /add up to 40 but the sheet's total says 99/);
  assert.throws(() => mastersFromWorkbook(targetBook("2026-NOVEMBER -RV SALE", "OCT TARGET", 40)), /says oct but/);
  assert.throws(() => mastersFromWorkbook(targetBook("no month here", "NOV TARGET", 40)), /month is unknown/);
});

test("salesmen and customers: pivot blanks become empty, totals are ignored, bad codes are reported", () => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "SALESMAN MASTER", [["DEPT", "(All)"], [], ["Salesman Code", "Salesman Name", "STATUS.", "TEAM_LEAD", "MANAGER_NAME", "SALES_CATEGORY", "ROUTE"], ["002", "MIN", "IN ACTIVE", "NOUSHAD", "SALEEM", "3--DTS", "(blank)"], [606, "ADAM", "ACTIVE", "(blank)", "(blank)", "1", "R1"], ["Grand Total"], ["BAD CODE", "BAD", "ACTIVE", "", "", "", ""]]);
  sheet(wb, "CUSTOMER MASTER", [["SLMA_ACNO", "COAD_PTY_FULL_NAME", "CREDIT_DAYS", "ACCOUNTANT", "COAD_GROUP_DESC", "SLMA_STATUS", "Sum of BALANCE"], ["C210001", "CARREFOUR", 60, "(blank)", "CARREFOUR_", "Active", 1250.5], ["A110001", "TEST", "(blank)", "(blank)", "GENERAL", "Inactive", 0], ["Grand Total"]]);
  const m = mastersFromWorkbook(wb);
  assert.deepEqual(m.salesmen.map((s) => [s.code, s.status, s.teamLead, s.route]), [["002", "Inactive", "NOUSHAD", null], ["606", "Active", null, "R1"]]);
  assert.deepEqual(m.customers.map((c) => [c.code, c.creditDays, c.accountant, c.status, c.balance]), [["C210001", 60, null, "Active", 1250.5], ["A110001", null, null, "Inactive", 0]]);
  assert.equal(m.issues.length, 1);
  assert.equal(m.period, null, "no target sheets, so no month");
});

test("items and brands: a brand keeps its manager, one listed twice is flagged, spaced types are joined", () => {
  const wb = new ExcelJS.Workbook();
  sheet(wb, "MANAGERS WITH BRAND", [["DEPT.", "BRAND NAME", "MANAGER NAME", "CATEGORY"], [201, "KDD", "SAJID", "FDD"], [201, "kdd", "SALEEM", "FDD"]]);
  sheet(wb, "PRODUCT & STOCK LIST", [["BRAND", "ITEM_CODE", "ITEM DESCRIPTION", "PACKING", "SIZE", "TYPE", "MANAGER", "DEPT."], ["KDD", "725000401", "JUICE", "8X12", "250ML", "S PROMO", "SAJID", "FDD"], ["NEW BRAND", "725000402", "WATER", "", "", "SHELF", "", ""]]);
  const m = mastersFromWorkbook(wb);
  assert.equal(m.items[0].itemType, "SPROMO");
  assert.equal(m.brands.find((b) => b.code === "KDD")?.manager, "SALEEM");
  assert.ok(m.brands.some((b) => b.code === "NEW BRAND"), "a brand seen only on an item is still created");
  assert.match(m.issues[0].reason, /listed under both SAJID and SALEEM/);
});

test("a workbook with none of the sheets gives nothing", () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Sheet1");
  assert.equal(mastersFromWorkbook(wb).rowsRead, 0);
});
