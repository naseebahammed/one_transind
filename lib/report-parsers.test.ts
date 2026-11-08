import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { cellDate, checkDaily, cogsForCompany, cogsFromWorkbook, dailyFromWorkbook, matchAccounts, num, pnlFromWorkbook, receiptsFromWorkbook, unitsFromWorkbook } from "./report-parsers.ts";
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

// A Daily Sales Deposit sheet: title in B1, headings in row 3, a date per row, 31 rows even in a 30-day month, totals below.
const depositSheet = (wb: ExcelJS.Workbook, name: string, ym: string, days: number[][], lastRowDate?: string) => {
  const ws = wb.addWorksheet(name);
  ws.getCell("B1").value = "Mr Shawarma Bin Omran";
  ["Bank Deposits", "Date Of Deposit", "Gross Sales", "Cash Sales", "Credit Card Sales"].forEach((h, i) => { ws.getCell(3, 3 + i).value = h; });
  for (let d = 0; d < 31; d++) {
    const row = 4 + d, [cash = 0, card = 0, deposit = 0] = days[d] ?? [];
    ws.getCell(row, 2).value = { formula: "B4+1", result: d === 30 && lastRowDate ? new Date(`${lastRowDate}T00:00:00Z`) : new Date(`${ym}-${String(d + 1).padStart(2, "0")}T00:00:00Z`) };
    ws.getCell(row, 3).value = deposit; ws.getCell(row, 6).value = cash; ws.getCell(row, 7).value = card;
  }
  ws.getCell(35, 3).value = { formula: "SUM(C4:C34)", result: 1 }; ws.getCell(36, 5).value = "Total Cash Sales";
  return ws;
};

test("receiptsFromWorkbook keeps real zero days, drops the unfilled end of the newest sheet and the 31st row of a short month", async () => {
  const wb = new ExcelJS.Workbook();
  depositSheet(wb, "April2026", "2026-04", [[10, 5, 10], [0, 0, 0], [7, 3, 7]], "2026-05-01");
  depositSheet(wb, "MAY 2026 ", "2026-05", [[1, 2, 1], [4, 6, 4]]);
  const { title, rows } = receiptsFromWorkbook(wb);
  assert.equal(title, "Mr Shawarma Bin Omran");
  const dates = [...new Set(rows.map((r) => r.date))];
  assert.equal(dates.length, 30 + 2); // April: its 30 days; May: only through 2 May. April's 31st row (dated 1 May, zeros) is dropped.
  assert.ok(rows.some((r) => r.date === "2026-04-02" && r.line === "Cash sales" && r.value === 0), "a zero day inside a sheet is a real zero");
  assert.equal(rows.find((r) => r.date === "2026-05-01" && r.line === "Cash sales")?.value, 1);
  assert.equal(rows.find((r) => r.date === "2026-05-03"), undefined);
  assert.ok(!rows.some((r) => r.line === "Gross sales" || r.line === "Date of deposit"), "gross sales are calculated, not read");
});

test("receiptsFromWorkbook refuses two sheets with the same date and figures dated outside the sheet's month", () => {
  const dup = new ExcelJS.Workbook();
  depositSheet(dup, "FEB", "2026-02", [[1, 1, 1]]);
  depositSheet(dup, "FEBRUARY", "2026-02", [[2, 2, 2]]);
  assert.throws(() => receiptsFromWorkbook(dup), /FEBRUARY and FEB both have the date 2026-02-01/);
  const stray = new ExcelJS.Workbook();
  const ws = depositSheet(stray, "June 2026", "2026-06", [[1, 1, 1]]);
  ws.getCell(34, 6).value = 99; // the extra 31st row holds a figure
  assert.throws(() => receiptsFromWorkbook(stray), /outside the sheet's month/);
});

test("receiptsFromWorkbook sets aside a sheet dated in another month and still loads the rest", () => {
  const wb = new ExcelJS.Workbook();
  depositSheet(wb, "JANUARY", "2026-02", [[1, 1, 1]]);
  depositSheet(wb, "FEBRUARY", "2026-02", [[2, 2, 2]]);
  const { rows, issues } = receiptsFromWorkbook(wb);
  assert.equal(rows.find((r) => r.date === "2026-02-01" && r.line === "Cash sales")?.value, 2);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].sheet, "JANUARY");
  assert.equal(issues[0].loaded, false);
});

test("receiptsFromWorkbook gives a date typed without a year its sheet's year, by row position", () => {
  const wb = new ExcelJS.Workbook();
  const ws = depositSheet(wb, "March 2026", "2026-03", [[5, 1, 5], [6, 1, 6]]);
  ws.getCell(4, 2).value = new Date("1900-03-01T00:00:00Z");
  ws.getCell(5, 2).value = new Date("1900-03-02T00:00:00Z");
  assert.equal(receiptsFromWorkbook(wb).rows.find((r) => r.date === "2026-03-02" && r.line === "Cash sales")?.value, 6);
});

test("receiptsFromWorkbook flags a typed gross that disagrees, a figure with no heading, and refuses only the row with an error cell", () => {
  const wb = new ExcelJS.Workbook();
  const ws = depositSheet(wb, "April 2026", "2026-04", [[10, 5, 10], [20, 5, 20], [30, 5, 30]]);
  ws.getCell(3, 9).value = "Keeta"; // column H stays without a heading, I is the last heading
  ws.getCell(4, 5).value = 15; ws.getCell(5, 5).value = 99; ws.getCell(6, 5).value = 35;
  ws.getCell(4, 8).value = 7;
  ws.getCell(5, 9).value = { formula: "1/0", result: { error: "#DIV/0!" } } as ExcelJS.CellValue;
  const { rows, issues, rowsRead, controlTotal } = receiptsFromWorkbook(wb);
  assert.equal(rows.some((r) => r.date === "2026-04-02"), false, "the row with the error cell is left out");
  assert.deepEqual(issues.map((x) => [x.row, x.loaded]).sort(), [[4, true], [5, false]]);
  assert.match(issues.find((x) => x.loaded)!.reason, /column 8 holds 7/);
  assert.ok(rowsRead >= 2);
  assert.equal(controlTotal, 50);
});

test("receiptsFromWorkbook leaves out sheets older than fromYear", () => {
  const wb = new ExcelJS.Workbook();
  depositSheet(wb, "December 2025", "2025-12", [[1, 1, 1]]);
  depositSheet(wb, "January 2026", "2026-01", [[2, 2, 2]]);
  assert.equal(receiptsFromWorkbook(wb, 2026).rows.some((r) => r.date.startsWith("2025")), false);
});

test("cogsFromWorkbook reads the top block only, makes costs negative, skips working sheets and branches with no sales", () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("OCT-2026");
  [["Description", "Bin Omran", "Asian Wok", "CK", "TOTAL"], ["Gross Sales", 100, null, null, 100], ["Disc Sales", 10, null, null, 10], ["Net Sales", 89, 0, 0, 89], ["CPU TRANSFER ( Purchase )", 30, null, -30, 0],
    ["Stock TB ( GL Balance )", 5, null, 50, 55], ["Closing INVENTORY 31/10/26", 4, null, 40, 44], ["COGS", 31, 0, 0, 31], ["Cost %", { formula: "1/0", result: { error: "#DIV/0!" } }, 0, 0, 0], [], ["Cost of Goodsold", 999, 0, 0, 0]]
    .forEach((r, i) => r.forEach((v, n) => { ws.getCell(4 + i, 2 + n).value = v as ExcelJS.CellValue; }));
  const working = wb.addWorksheet("JAN-20 working");
  working.getCell("B4").value = "Description";
  const { rows, issues } = cogsFromWorkbook(wb, 2026);
  assert.deepEqual([...new Set(rows.map((r) => r.branch))], ["Bin Omran"]);
  const value = (line: string) => rows.find((r) => r.line === line)?.value;
  assert.equal(value("Gross sales"), 100); assert.equal(value("Discount"), -10); assert.equal(value("CPU transfer"), -30); assert.equal(value("COGS"), -31); assert.equal(value("Closing inventory"), 4);
  assert.equal(rows[0].month, 9);
  assert.equal(issues.length, 1, "gross 100 less discount 10 is not the 89 in the sheet");
  assert.equal(cogsFromWorkbook(wb, 2027).rows.length, 0);
});

test("cogsForCompany keeps one company's columns, finds their branches and holds back an unconfirmed column", () => {
  const row = (branch: string) => ({ year: 2026, month: 9, branch, line: "COGS", value: -1 });
  const rows = ["Mr.Shawarma Bin Omran", "West Bay", "Asian Wok Old airport", "Burger Stop", "Mr.Shawarma Gharafa", "New Kitchen", "New Kitchen"].map(row);
  const shawarma = cogsForCompany(rows, "Mr. Shawarma", [{ id: 1, name: "Bin Omran" }, { id: 2, name: "Qatar Sports Club" }, { id: 3, name: "Gharafa" }]);
  assert.deepEqual(shawarma.rows.map((r) => [r.branch, r.branchId]), [["Mr.Shawarma Bin Omran", 1], ["West Bay", 2], ["Mr.Shawarma Gharafa", 3]]);
  assert.match(shawarma.issues[0].reason, /"New Kitchen" has no confirmed owner/);
  assert.equal(shawarma.issues.length, 1, "reported once, however many rows the column has");
  assert.deepEqual(cogsForCompany(rows, "Asian Wok", []).rows.map((r) => r.branchId), [null]);
  assert.deepEqual(cogsForCompany(rows, "Burger Stop", [{ id: 9, name: "Gharafa" }]).rows.map((r) => [r.branch, r.branchId]), [["Burger Stop", null]], "whole company, and another brand's Gharafa column never lands here");
  assert.throws(() => cogsForCompany(rows, "Mr. Shawarma", [{ id: 2, name: "Qatar Sports Club" }]), /no branch for the column "Mr.Shawarma Bin Omran"/);
});

test("receiptsFromWorkbook asks for a recalculated file when a date was never calculated", () => {
  const wb = new ExcelJS.Workbook();
  const ws = depositSheet(wb, "April2026", "2026-04", [[1, 1, 1], [2, 2, 2]]);
  ws.getCell(5, 2).value = { formula: "B4+1" } as ExcelJS.CellValue;
  assert.throws(() => receiptsFromWorkbook(wb), /date was never calculated/);
});
