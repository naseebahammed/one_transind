import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { cellDate, checkDaily, dailyFromWorkbook, matchAccounts, num, pnlFromWorkbook, unitsFromWorkbook } from "./report-parsers.ts";
import { readWorkbook } from "./company-template.ts";

test("num reads numbers, formulas and CSV text, keeps blank as null, and refuses text", () => {
  assert.equal(num(5.126, "x"), 5.13);
  assert.equal(num({ formula: "A1", result: 7 } as ExcelJS.CellValue, "x"), 7);
  assert.equal(num("1,234.50", "x"), 1234.5);
  assert.equal(num("(50)", "x"), -50);
  assert.equal(num(null, "x"), null);
  assert.equal(num("", "x"), null);
  assert.equal(num("-", "x"), null);
  assert.equal(num(0, "x"), 0);
  assert.throws(() => num("n/a", "Row 4, Jan"), /Row 4, Jan: "n\/a" is not a number/);
  assert.throws(() => num({ error: "#REF!" } as ExcelJS.CellValue, "x"), /#REF!/);
});

test("cellDate reads date cells, ISO and dd/mm/yyyy text, and refuses an impossible date", () => {
  assert.equal(cellDate(new Date("2026-10-01T00:00:00Z"), "x"), "2026-10-01");
  assert.equal(cellDate("2026-10-01", "x"), "2026-10-01");
  assert.equal(cellDate("01/10/2026", "x"), "2026-10-01");
  assert.equal(cellDate("Sub total", "x"), null);
  assert.throws(() => cellDate("31/02/2026", "x"), /not a real date/);
});

const csv = (text: string) => readWorkbook(Buffer.from(text));
const xlsx = async (grid: (string | number | Date | null)[][]) => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Data");
  grid.forEach((r) => ws.addRow(r));
  return readWorkbook(Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer));
};

const DAILY_HEAD = ["Date", "Long Stay Guests", "Long Rate", "Long Total", "Short Stay Guests", "Short Rate", "Short Total", "Total Room Occupancy", "Daily Revenue", "Other Revenue", "Daily Avg Rate", "Rms/Avl."];

test("the same daily report as .xlsx and as an Excel-saved .csv gives identical rows", async () => {
  const fromXlsx = dailyFromWorkbook(await xlsx([DAILY_HEAD, [new Date("2026-10-01T00:00:00Z"), 80, 200, 16000, 2, 400, 800, 82, 16800, 1234, 204.88, 87]]));
  const fromCsv = dailyFromWorkbook(await csv(`﻿${DAILY_HEAD.join(",")}\r\n01/10/2026,80,200,"16,000",2,400,800,82,"16,800","1,234",204.88,87\r\n`));
  assert.deepEqual(fromCsv, fromXlsx);
  assert.equal(fromCsv[0].date, "2026-10-01");
  assert.equal(fromCsv[0].long_total, 16000);
});

test("an ISO date in a CSV stays on its own day", async () => {
  const [row] = dailyFromWorkbook(await csv(`${DAILY_HEAD.join(",")}\n2026-10-01,80,200,16000,2,400,800,82,16800,0,204.88,87\n`));
  assert.equal(row.date, "2026-10-01");
});

test("a text value in a daily report rejects the file instead of loading as 0", async () => {
  const wb = await csv(`${DAILY_HEAD.join(",")}\n2026-10-01,80,200,16000,2,400,800,82,oops,0,204.88,87\n`);
  assert.throws(() => dailyFromWorkbook(wb), /"oops" is not a number/);
});

test("readWorkbook refuses a broken .xlsx and an old binary .xls", async () => {
  await assert.rejects(readWorkbook(Buffer.from("PK not really a zip")), /Excel workbook/);
  await assert.rejects(readWorkbook(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0])), /\.xlsx or \.csv/);
});

test("checkDaily catches more rooms occupied than available, and more available than the property has", () => {
  const day = { date: "2026-03-01", long_guests: 0, long_rate: 0, long_total: 0, short_guests: 0, short_rate: 0, short_total: 0, room_revenue: 0, other_revenue: 0 };
  assert.match(checkDaily([{ ...day, rooms_occupied: 90, rooms_available: 87 }], 87)!, /90 rooms occupied/);
  assert.match(checkDaily([{ ...day, rooms_occupied: 90, rooms_available: 30225 }], 119)!, /30225 rooms available/);
  assert.equal(checkDaily([{ ...day, rooms_occupied: 90, rooms_available: 0 }], 0), null);
  assert.equal(checkDaily([{ ...day, rooms_occupied: 87, rooms_available: 87 }], 87), null);
});

const PNL = [["Main account", null, null, "Account", "Jan-2026", "Feb-2026", "Mar-2026"], [null], ["REVENUE", null, null, "Room Rent", 100, 0, null], ["STAFF COST", null, null, "Staff Salary", null, 0, null], ["STAFF COST Total", null, null, "x", 999, 0, null]];

test("pnlFromWorkbook keeps a blank apart from a zero and leaves empty months out", async () => {
  const r = pnlFromWorkbook(await xlsx(PNL), 0);
  assert.ok("rows" in r);
  assert.deepEqual(r.rows, [{ year: 2026, month: 0, main: "REVENUE", line: "Room Rent", value: 100 }]); // Feb has only zeros and Mar nothing, so those months on file stay
});

test("pnlFromWorkbook stores a real zero in a month that has figures", async () => {
  const r = pnlFromWorkbook(await xlsx([PNL[0], [null], ["REVENUE", null, null, "Room Rent", 100], ["STAFF COST", null, null, "Staff Salary", 0], ["COGS", null, null, "COS - Food", null]]), 0);
  assert.ok("rows" in r);
  assert.deepEqual(r.rows.map((x) => [x.line, x.value]), [["Room Rent", 100], ["Staff Salary", 0]]);
});

test("the same P&L as .xlsx and .csv gives identical rows", async () => {
  const text = PNL.map((r) => [...r, ...Array(7 - r.length).fill(null)].map((c) => c ?? "").join(",")).join("\n");
  assert.deepEqual(pnlFromWorkbook(await csv(text), 0), pnlFromWorkbook(await xlsx(PNL), 0));
});

test("pnlFromWorkbook refuses text in a figure and a sheet with no month columns or revenue", async () => {
  await assert.rejects(async () => pnlFromWorkbook(await xlsx([PNL[0], [null], ["REVENUE", null, null, "Room Rent", "abc"]]), 0), /Row 3, Jan: "abc"/);
  assert.ok("error" in pnlFromWorkbook(await xlsx([["nothing"]]), 0));
  assert.ok("error" in pnlFromWorkbook(await xlsx([PNL[0], [null], ["COGS", null, null, "COS - Food", 5]]), 0));
});

const line = (main: string, l: string, value: number) => ({ year: 2026, month: 0, main, line: l, value });
const chart = [{ main: "COGS", sub: "COS - Food" }, { main: "REVENUE", sub: "Room Rent" }];

test("matchAccounts uses the chart's spelling and adds up lines that differ only by spacing", () => {
  const r = matchAccounts([line("COGS", "COS -  Food", -5), line("cogs", "cos - food", -2.5)], chart);
  assert.ok("rows" in r);
  assert.deepEqual(r.rows, [line("COGS", "COS - Food", -7.5)]);
});

test("matchAccounts refuses an unknown account with a figure, and drops one with only zeros", () => {
  const bad = matchAccounts([line("COGS", "Typo", -5)], chart);
  assert.ok("error" in bad);
  assert.match(bad.error, /COGS \| Typo/);
  assert.deepEqual(matchAccounts([line("COGS", "Typo", 0)], chart), { rows: [] });
});

test("dailyFromWorkbook reads every sheet, by header, and skips days with no guests", () => {
  const wb = new ExcelJS.Workbook();
  const head = ["Date", "Long Stay Guests", "Avg Rate", "Total", "Short Stay Guests", "Avg Rate", "Total", "Total Room Occupancy", "Daily Revenue Aparment", "Other Revenue", "Total Revenue", "Daily Avg Rate", "Rms/Avl.", "OCC%"];
  for (const day of ["2026-01-01", "2026-02-01"]) {
    const ws = wb.addWorksheet(day);
    ws.addRow(["title"]); ws.addRow([null, "LONG STAY"]); ws.addRow(head);
    ws.addRow([{ formula: "A1", result: new Date(day) }, 80, 200, 16000, 2, 300, 600, 82, 16600, 100, 16700, 202, 87, 0.94]);
    ws.addRow([new Date(day), null, null, null, null, null, null, null, null, null, null, null, 87, null]); // future day
    ws.addRow(["Sub total", 80]);
  }
  const out = dailyFromWorkbook(wb);
  assert.deepEqual(out.map((r) => r.date), ["2026-01-01", "2026-02-01"]);
  assert.deepEqual(out[0], { date: "2026-01-01", long_guests: 80, long_rate: 200, long_total: 16000, short_guests: 2, short_rate: 300, short_total: 600, rooms_occupied: 82, room_revenue: 16600, other_revenue: 100, rooms_available: 87 });
});

test("unitsFromWorkbook totals per unit type and re-dates a mislabelled sheet", () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("x");
  ws.addRow(["120 Residence Jan-2026"]);
  ws.addRow(["S.No", "Date", "Availability", "Availability", "Long Stay", "Long Stay", "Revenue", "Revenue", "Other Revenue"]);
  ws.addRow(["S.No", "Date", "1 BHK", "2 BHK", "1 BHK", "2 BHK", "1 BHK", "2 BHK", "Spa"]);
  ws.addRow([1, new Date("2026-02-01T00:00:00Z"), 10, 5, 9, 4, 900, 800, 50]); // date says Feb, sheet says Jan
  ws.addRow([2, new Date("2026-02-02T00:00:00Z"), 10, 5, 8, 4, 100, 200, 50]);
  const out = unitsFromWorkbook(wb);
  assert.ok(out.every((r) => r.year === 2026 && r.month === 0));
  assert.equal(out.find((r) => r.unit_type === "1 BHK" && r.line === "Room revenue")?.value, 1000);
  assert.equal(out.find((r) => r.unit_type === "2 BHK" && r.line === "Long stay")?.value, 8);
  assert.ok(!out.some((r) => r.line === "Spa" || r.unit_type === "Spa"));
});
