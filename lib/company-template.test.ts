import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseGrid } from "./company-data.ts";
import { buildFigureTemplate, buildPnlTemplate, gridFromWorkbook } from "./company-template.ts";

const reload = async (wb: ExcelJS.Workbook) => {
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(await wb.xlsx.writeBuffer() as ExcelJS.Buffer);
  return out;
};

test("a filled template survives a save and reload", async () => {
  const wb = buildFigureTemplate("Acme", "budget", 2026);
  const ws = wb.worksheets[0];
  ws.getCell("B3").value = 100; ws.getCell("B4").value = 60; ws.getCell("B5").value = 20;
  const r = parseGrid("budget", gridFromWorkbook(await reload(wb)), { company: "Acme", year: 2026 }, new Date(2026, 10, 4));
  assert.ok("figures" in r, "error" in r ? r.error : "");
  assert.deepEqual(r.figures.map((f) => [f.line, f.month, f.value]), [["Revenue", 0, 100], ["Direct cost", 0, 60], ["Overheads", 0, 20]]);
});

test("formula cells give their calculated value", () => {
  const wb = buildFigureTemplate("Acme", "budget", 2026);
  wb.worksheets[0].getCell("B3").value = { formula: "1+1", result: 2 };
  assert.equal(gridFromWorkbook(wb)[2][1], 2);
});

test("blank cells stay blank", () => {
  assert.equal(gridFromWorkbook(buildFigureTemplate("Acme", "budget", 2026))[2][5], null);
});

test("text numbers are kept as text for the validator", () => {
  const wb = buildFigureTemplate("Acme", "budget", 2026);
  wb.worksheets[0].getCell("B3").value = "1,200";
  assert.equal(gridFromWorkbook(wb)[2][1], "1,200");
});

test("reads the first visible sheet", () => {
  const wb = buildFigureTemplate("Acme", "budget", 2026);
  wb.worksheets[0].state = "hidden";
  wb.addWorksheet("shown").getCell("A1").value = "here";
  assert.equal(gridFromWorkbook(wb)[0][0], "here");
});

test("P&L template has exactly one month column", () => {
  const ws = buildPnlTemplate(2026, 9, [{ main: "REVENUE", sub: "Room Rent" }]).worksheets[0];
  assert.equal(ws.getCell("A1").value, "Main account");
  assert.equal(ws.getCell("D1").value, "Account");
  assert.equal(ws.getCell("E1").value, "Oct-2026");
  assert.equal(ws.getCell("F1").value, null);
  assert.equal(ws.getCell("A3").value, "REVENUE");
  assert.equal(ws.getCell("D3").value, "Room Rent");
});
