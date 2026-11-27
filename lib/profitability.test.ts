import assert from "node:assert/strict";
import test from "node:test";
import { parseProfitability } from "./profitability.ts";

const customs = (rows: unknown[][]) => [[], ["SALES REPORT"], ["INVOICE NO.", "CUSTOMER", "SALES", "COST", "Inspection", "MARGINE"], ...rows];

test("profitability: invoice rows are added up, total rows and the sheet's own margin are ignored", () => {
  const { rows, errors } = parseProfitability([{ name: "JAN-26", grid: customs([["IN1", "ACME", 100.5, 60, 5, 999], ["IN2", "ACME", 200, 150, null, 999], [null, null, 300.5, 210, null, 999], ["Total", null, 300.5, 210]]) }], "Clearing");
  assert.deepEqual(errors, []);
  assert.deepEqual(rows, [{ line: "Clearing", month: 1, sales: 300.5, cost: 210, invoices: 2 }]);
});

test("profitability: the trucking layout (Total Invoice / Total Cost) and a Kuwait sheet go to their own line", () => {
  const trucks = (rows: unknown[][]) => [[], ["SALES REPORT"], ["INVOICE NO.", "NO OF TRUCKS", "TOTAL INVOICE AMT.", "TOTAL COST", "MARGIN"], ...rows];
  const { rows } = parseProfitability([{ name: "OCT-2026 ", grid: trucks([["IN9", 2, 21606, 19600, 2006]]) }, { name: "MAY 26 -KWTLOGISTICS", grid: [["Invoice No.", "Cost", "Sales"], ["IN1", 0, 414.07]] }], "Freight");
  assert.deepEqual(rows.map((r) => [r.line, r.month, r.sales, r.cost]), [["Freight", 10, 21606, 19600], ["Kuwait logistics", 5, 414.07, 0]]);
});

test("profitability: a sheet with no month or no headings, or two sheets for one month, refuses the file", () => {
  const { errors } = parseProfitability([{ name: "Sheet1", grid: customs([]) }, { name: "FEB", grid: [["x"]] }, { name: "MAR", grid: customs([]) }, { name: "MARCH", grid: customs([]) }], "Clearing");
  assert.equal(errors.length, 3);
  assert.match(errors[0], /no month/);
  assert.match(errors[1], /no Sales and Cost/);
  assert.match(errors[2], /already has a sheet/);
});
