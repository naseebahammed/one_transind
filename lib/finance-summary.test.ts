import test from "node:test";
import assert from "node:assert/strict";
import { costBreakdownByYear, expenseRowsFor, reportsFor, salesFor } from "./finance-summary.ts";
import { loadReports } from "./reports.ts";

const figures = [
  { id: 1, section: "pnl", y: 2025, mo: 0, main: "REVENUE", line: "Room Rent", unit_type: "", v: 1000 },
  { id: 1, section: "pnl", y: 2025, mo: 0, main: "STAFF COST", line: "Salaries", unit_type: "", v: -300 },
  { id: 1, section: "pnl", y: 2025, mo: 0, main: "UTILITY EXPENSES", line: "Water", unit_type: "", v: -100 },
  { id: 1, section: "sales", y: 2025, mo: 0, main: "REVENUE", line: "Sales", unit_type: "", v: 500 },
  { id: 1, section: "sales", y: 2025, mo: 1, main: "REVENUE", line: "Sales", unit_type: "", v: 700 },
  { id: 2, section: "pnl", y: 2025, mo: 0, main: "REVENUE", line: "Room Rent", unit_type: "", v: 2000 },
  { id: 2, section: "pnl", y: 2025, mo: 0, main: "STAFF COST", line: "Salaries", unit_type: "", v: -900 },
];
const derived = [{ id: 1, y: 2025, mo: 0, main: "ROOMS", line: "Occupied", v: 80 }];

const fakeQuery = async <T,>(sql: string) =>
  (sql.includes("daily_sales_monthly") ? derived : sql.includes("app.companies") ? [{ id: 1 }] : sql.includes("app.daily_sales") ? [] : figures) as T[];

test("reportsFor and salesFor summarize P&L and monthly sales per company", async () => {
  const reports = await loadReports(fakeQuery);
  const pnl = reportsFor(reports, { id: 1 });
  assert.equal(pnl.length, 1);
  assert.equal(pnl[0].year, 2025);
  assert.equal(pnl[0].revenue[0], 1000);
  assert.equal(pnl[0].cost[0], 400);
  assert.equal(pnl[0].net[0], 600);

  // salesFor sums REVENUE lines only, ignoring ROOMS / GUESTS lines in the sales bucket
  assert.deepEqual(salesFor(reports, { id: 1 }), [{ year: 2025, revenue: 1200 }]);
  assert.deepEqual(salesFor(reports, { id: 99 }), []);
});

test("costBreakdownByYear aggregates visible companies and excludes hidden ones", async () => {
  const reports = await loadReports(fakeQuery);
  const c1 = { id: 1, hidden: 0 }, c2 = { id: 2, hidden: 1 };
  const entries = [
    ...reportsFor(reports, c1).map((r) => ({ c: c1, r })),
    ...reportsFor(reports, c2).map((r) => ({ c: c2, r })),
  ];
  assert.deepEqual(costBreakdownByYear(entries), [{ year: 2025, top: [["Staff cost", 300], ["Utilities", 100]] }]);
});

test("expenseRowsFor keeps unsubmitted months as null and verified zero as 0", () => {
  const rows = expenseRowsFor(
    [{ id: 1, name: "Acme" }, { id: 2, name: "Empty" }],
    [
      { company_id: 1, year: 2026, month: 0, value: 250 },
      { company_id: 1, year: 2026, month: 1, value: 0 },
    ],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].year, 2026);
  assert.deepEqual(rows[0].m, [250, 0, null, null, null, null, null, null, null, null, null, null]);
});
