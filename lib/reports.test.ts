// The report readers: loading figures, P&L totals, occupancy and average daily rate. The first three tests were written before the refactoring moved this code (refactoring_plan.md, Step 0).
import test from "node:test";
import assert from "node:assert/strict";
import { alManzilKey, dailyYears, loadReports, occupancy, plRows, report, revenueLines, years } from "./reports.ts";

const m = (...v: number[]) => [...v, ...Array(12 - v.length).fill(0)];

// What each query in loadReports returns, in the order the SQL sorts it. Revenue positive, costs negative, QAR.
const figures = [
  { id: 7, section: "pnl", y: 2025, mo: 0, main: "REVENUE", line: "Room Rent", unit_type: "", v: 1000 },
  { id: 7, section: "pnl", y: 2025, mo: 1, main: "REVENUE", line: "Room Rent", unit_type: "", v: 2000 },
  { id: 7, section: "pnl", y: 2025, mo: 0, main: "REVENUE", line: "Space Rental", unit_type: "", v: 500 },
  { id: 7, section: "pnl", y: 2025, mo: 0, main: "STAFF COST", line: "Salaries", unit_type: "", v: -300 },
  { id: 7, section: "pnl", y: 2026, mo: 0, main: "REVENUE", line: "Room Rent", unit_type: "", v: 900 },
  { id: 7, section: "units", y: 2025, mo: 2, main: "UNITS", line: "Long stay", unit_type: "1 BHK", v: 4 },
  { id: 8, section: "pnl", y: 2024, mo: 5, main: "REVENUE", line: "Room Rent", unit_type: "", v: 50 },
];
const derived = [{ id: 7, y: 2025, mo: 0, main: "REVENUE", line: "Room revenue", v: 1000 }];
const day = (date: string, long_guests: number, short_guests: number, rooms_occupied: number, room_revenue: number, other_revenue: number) =>
  ({ id: 7, date, long_guests, long_rate: 0, long_total: 0, short_guests, short_rate: 0, short_total: 0, rooms_occupied, room_revenue, other_revenue, rooms_available: 10 });
const days = [day("2025-01-01", 2, 1, 3, 600, 50), day("2025-01-02", 1, 1, 2, 400, 0), day("2025-02-01", 0, 4, 4, 800, 0)];

const fakeQuery = async <T,>(sql: string) =>
  (sql.includes("app.companies") ? [{ id: 7 }] : sql.includes("daily_sales_monthly") ? derived : sql.includes("app.daily_sales") ? days : figures) as T[];

test("loadReports + readers: years, Al Manzil key, revenue lines and P&L totals", async () => {
  await loadReports(fakeQuery);
  assert.equal(alManzilKey(), "7");
  assert.deepEqual(years("7"), [2025, 2026]);
  assert.deepEqual(years("7", "sales"), [2025]);
  assert.deepEqual(years("7", "units"), [2025]);
  assert.deepEqual(years(["7", "8"]), [2024, 2025, 2026]);
  assert.deepEqual(revenueLines(2025, "7"), [["Room Rent", 3000], ["Space Rental", 500]]);

  const r = report(2025, "7");
  assert.deepEqual(r.revenue, m(1500, 2000));
  assert.deepEqual(r.roomRent, m(1000, 2000));
  assert.deepEqual(r.totalCost, m(300)); // costs stored negative, reported as a positive cost
  assert.deepEqual(r.net, m(1200, 2000));
  assert.deepEqual(r.costGroups, [["Staff cost", m(300)]]);
});

test("loadReports + readers: unit-type rows and derived monthly sales", async () => {
  await loadReports(fakeQuery);
  assert.deepEqual(plRows(2025, "7", "units"), [{ year: 2025, main: "1 BHK", sub: "Long stay", m: m(0, 0, 4) }]);
  assert.deepEqual(plRows(2025, "7", "sales"), [{ year: 2025, main: "REVENUE", sub: "Room revenue", m: m(1000) }]);
});

test("occupancy and average daily rate are calculated per month from the daily rows", async () => {
  await loadReports(fakeQuery);
  assert.deepEqual(dailyYears("7"), [2025]);
  const [jan, feb, mar] = occupancy(2025, "7");
  assert.deepEqual(jan, { days: 2, sold: 5, avail: 20, occ: 0.25, adr: 200, longShare: 0.6, room: 1000, other: 50 });
  assert.deepEqual(feb, { days: 1, sold: 4, avail: 10, occ: 0.4, adr: 200, longShare: 0, room: 800, other: 0 });
  assert.deepEqual(mar, { days: 0, sold: 0, avail: 0, occ: 0, adr: 0, longShare: 0, room: 0, other: 0 });
});

const rows = [{ year: 2025, main: "REVENUE", sub: "Extra Bed", m: Array(12).fill(10) }];

test("a year without a Room Rent row still reports", () => {
  const r = report(2025, "4", rows);
  assert.equal(r.revenue[0], 10);
  assert.deepEqual(r.roomRent, Array(12).fill(0));
});
