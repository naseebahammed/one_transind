import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseGrid } from "./company-data.ts";
import { DAILY_HEADER, dailyFromWorkbook, mergeDaily, mergeSales, PNL_HEADER, unitsFromWorkbook } from "./al-manzil.ts";
import { buildDailyTemplate, buildFigureTemplate, buildPnlTemplate, buildUnitsTemplate, gridFromWorkbook } from "./company-template.ts";

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

const fillDay = (ws: ExcelJS.Worksheet, row: number, cells: Record<string, number>) => {
  const head = new Map<string, number>();
  ws.getRow(1).eachCell((c, n) => head.set(String(c.value), n));
  for (const [k, v] of Object.entries(cells)) ws.getCell(row, head.get(k)!).value = v;
};

test("a filled daily template loads through the real daily uploader", async () => {
  const wb = buildDailyTemplate(2026, 9, 87);
  fillDay(wb.worksheets[0], 2, { "Long Stay Guests": 80, "Long Rate": 200, "Long Total": 16000, "Short Stay Guests": 2, "Short Rate": 400, "Short Total": 800, "Total Room Occupancy": 82, "Daily Revenue": 16800, "Other Revenue": 1000, "Daily Avg Rate": 204.88 });
  const lines = dailyFromWorkbook(await reload(wb));
  assert.deepEqual(lines, ["2026-10-01,80,200,16000,2,400,800,82,16800,1000,204.88,87,0.9425"]);
  assert.ok(mergeDaily("", [DAILY_HEADER, ...lines].join("\n")).includes("2026-10-01"));
});

test("the daily template lists every day of the month and skips days left blank", async () => {
  const ws = buildDailyTemplate(2026, 1, 87).worksheets[0];
  assert.equal(ws.rowCount, 29); // header + 28 days of Feb 2026
  assert.equal((ws.getCell("A29").value as Date).toISOString().slice(0, 10), "2026-02-28");
  assert.deepEqual(dailyFromWorkbook(await reload(buildDailyTemplate(2026, 1, 87))), []);
});

test("the daily template leaves rooms available blank when the room count is unknown", () => {
  const ws = buildDailyTemplate(2026, 1, 0).worksheets[0];
  assert.equal(ws.getCell(2, 12).value, null);
});

test("a filled unit-type template loads through the real unit-type uploader", async () => {
  const wb = buildUnitsTemplate(2026, 9, ["1 BHK", "2 BHK"]);
  const ws = wb.worksheets[0];
  const col = (group: string, type: string) => { let n = 0; ws.getRow(1).eachCell((c, i) => { if (c.value === group && ws.getCell(2, i).value === type) n = i; }); return n; };
  ws.getCell(3, col("Availability", "1 BHK")).value = 10;
  ws.getCell(3, col("Long Stay", "1 BHK")).value = 8;
  ws.getCell(3, col("Short Stay", "1 BHK")).value = 1;
  ws.getCell(3, col("Room Revenue", "1 BHK")).value = 1800;
  const { lines, months } = unitsFromWorkbook(await reload(wb));
  assert.ok(months.has("2026-9"));
  const of = (m: string) => lines.find((l) => l.startsWith(`2026,1 BHK,${m},`))?.split(",")[3 + 9];
  assert.deepEqual([of("Available"), of("Long stay"), of("Short stay"), of("Room revenue")], ["10", "8", "1", "1800"]);
});

test("the unit-type template falls back to 1 BHK and 2 BHK when no room types are set", () => {
  const ws = buildUnitsTemplate(2026, 9, []).worksheets[0];
  assert.equal(ws.getCell("B2").value, "1 BHK");
  assert.equal(ws.getCell("C2").value, "2 BHK");
});

const sellingToday = new Date(2026, 10, 4);

test("a filled monthly sales template reads through the shared validator", async () => {
  const wb = buildFigureTemplate("Pavati", "sales", 2026);
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell("A1").value, "Pavati | Monthly sales | 2026");
  assert.equal(ws.getCell("A3").value, "Sales");
  ws.getCell("K3").value = 165832.1; // Oct, column B is Jan
  const r = parseGrid("sales", gridFromWorkbook(await reload(wb)), { company: "Pavati", year: 2026 }, sellingToday);
  assert.ok("figures" in r, "error" in r ? r.error : "");
  assert.deepEqual(r.figures.map((f) => [f.month, f.value]), [[9, 165832.1]]);
});

test("monthly sales rejects another company's file, future months and negatives", () => {
  const grid = (title: string, col: number, v: number) => { const g = gridFromWorkbook(buildFigureTemplate("Pavati", "sales", 2026)); g[0][0] = title; g[2][col] = v; return g; };
  const title = "Pavati | Monthly sales | 2026", want = { company: "Pavati", year: 2026 };
  assert.ok("error" in parseGrid("sales", grid("Top Perfume | Monthly sales | 2026", 1, 5), want, sellingToday));
  assert.ok("error" in parseGrid("sales", grid(title, 12, 5), want, sellingToday));
  assert.ok("error" in parseGrid("sales", grid(title, 1, -5), want, sellingToday));
});

test("mergeSales changes only the uploaded months and starts a new file or year", () => {
  const csv = `${PNL_HEADER}\r\n2026,REVENUE,Sales,1,2,3,4,5,6,7,8,9,0,0,0\r\n2025,REVENUE,Sales,9,9,9,9,9,9,9,9,9,9,9,9\r\n`;
  const out = mergeSales(csv, [{ year: 2026, month: 9, value: 500 }]).trim().split("\n");
  assert.equal(out[0], PNL_HEADER);
  assert.equal(out[1], "2026,REVENUE,Sales,1,2,3,4,5,6,7,8,9,500,0,0");
  assert.equal(out[2], "2025,REVENUE,Sales,9,9,9,9,9,9,9,9,9,9,9,9");
  assert.equal(mergeSales("", [{ year: 2026, month: 0, value: 7 }]), `${PNL_HEADER}\n2026,REVENUE,Sales,7,0,0,0,0,0,0,0,0,0,0,0\n`);
  assert.equal(mergeSales(csv, [{ year: 2024, month: 1, value: 7 }]).trim().split("\n").length, 4);
});
