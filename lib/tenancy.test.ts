import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildingKey, summarizeTenancy, tenanciesFromWorkbook } from "./tenancy.ts";

function workbook() {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("BALASEM 1");
  [["BALASAM COMPLEX - COMPOUND: 1"], ["SL NO", "VILLA NO", "TENANT NAME", "CONTRACT STARTS", "CONTRACT ENDS", "RENT / MONTH (QR)"],
    [1, 1, "GEORGES SALAME", new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 11, 31)), 7750],
    [2, "5-FF", "AYAH", new Date(Date.UTC(2025, 11, 1)), new Date(Date.UTC(2026, 10, 30)), 4600],
    [3, 7, "EMPTY", new Date(Date.UTC(2026, 10, 15)), new Date(Date.UTC(2027, 10, 14)), 6000],
    [4, 8, "OLD TENANT", new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2026, 7, 31)), 5000],
    [5, 9, "STAFF", null, null, 3000],
    [null, null, null, null, null, 369200]].forEach((r, i) => r.forEach((v, n) => { a.getCell(1 + i, 1 + n).value = v as ExcelJS.CellValue; }));
  wb.addWorksheet("PVT").getCell("A1").value = "not a tenancy sheet";
  return wb;
}

test("tenanciesFromWorkbook reads units per sheet, ignores totals and other sheets, and flags a tenant with no end date", () => {
  const { sheets, issues } = tenanciesFromWorkbook(workbook());
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].rows.length, 5);
  assert.deepEqual(sheets[0].rows[0], { line: 1, unit: "1", tenant: "GEORGES SALAME", contractStart: "2026-01-01", contractEnd: "2026-12-31", rent: 7750 });
  assert.equal(sheets[0].rows[2].tenant, null);
  assert.equal(issues.length, 1);
  assert.match(issues[0].reason, /no contract end date/);
});

test("summarizeTenancy counts vacant, pre-let, ending soon (soonest first) and contracts that already ended", () => {
  const s = summarizeTenancy(tenanciesFromWorkbook(workbook()).sheets[0].rows, "2026-11-12");
  assert.equal(s.total, 5);
  assert.equal(s.vacant, 1);
  assert.equal(s.occupied, 4);
  assert.equal(s.preLet.length, 1);
  assert.deepEqual(s.ending.map((r) => [r.unit, r.daysLeft]), [["5-FF", 18], ["1", 49]]);
  assert.deepEqual(s.ended.map((r) => r.unit), ["8"]);
  assert.equal(summarizeTenancy([], "2026-11-12").total, 0);
});

test("buildingKey matches sheet names to company names", () => {
  assert.equal(buildingKey("BALASEM 1"), buildingKey("Balasem Gardens 1"));
  assert.equal(buildingKey("ALSADD 36"), buildingKey("Al Sadd 36"));
  assert.equal(buildingKey("ALSADD 86"), buildingKey("Alsadd 86"));
  assert.notEqual(buildingKey("BALASEM 1"), buildingKey("Balasem Gardens 2"));
});
