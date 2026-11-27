import assert from "node:assert/strict";
import test from "node:test";
import { parseBrandMonthPlan, parseBrandYearPlan } from "./brand-budget.ts";

const yearHead = ["Brand (sheet)", "2025 actual", "2026 FC", "2027 target", "Growth vs 2026", "COGS", "2027 GP", "2027 GM %", "2027 Rebate", "2027 Secondary", "2027 Supplier"];

test("brand year plan: brands are read by heading, COGS becomes a negative cost, totals are left out", () => {
  const { rows, errors } = parseBrandYearPlan([[], yearHead,
    ["KDD", 100, 110, 120.5, 0.1, 60, 60.5, 0.5, 5, 4, 3],
    ["NEW ITEMS", null, null, 50, null, 30],
    ["Total with Current", 100, 110, 170.5],
    ["Discontinued", 9, 1, null]], 2027);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows.map((r) => [r.brand, r.priorActual, r.target, r.cogs, r.rebate]), [["KDD", 100, 120.5, -60, 5], ["NEW ITEMS", null, 50, -30, null]]);
});

test("brand year plan: a duplicate brand is reported and a wrong year refuses the file", () => {
  assert.match(parseBrandYearPlan([yearHead, ["KDD", 1, 1, 5], ["KDD", 1, 1, 6]], 2027).errors[0], /twice/);
  assert.match(parseBrandYearPlan([yearHead], 2028).errors[0], /2028 target/);
});

const monthHead = ["Manager", "Brand 1", "Group", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Total"];

test("brand month plan: blank months are skipped, a 0 is kept, rows without brand and group are totals", () => {
  const { rows, errors } = parseBrandMonthPlan([[], monthHead,
    ["Sajid", "KDD", "JUICE", 100, 0, null, 5, 5, 5, 5, 5, 5, 5, 5, 5, 999],
    [null, "CAMEL BEER", "CAMEL BEER", null, null, null, 50, 50, 50, 50, 50, 50, 50, 50, 50],
    [null, null, null, 150, 150, 150, 55, 55, 55, 55, 55, 55, 55, 55, 55]]);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 11 + 9);
  assert.deepEqual(rows.filter((r) => r.brand === "KDD").slice(0, 2).map((r) => [r.month, r.amount]), [[1, 100], [2, 0]]);
  assert.equal(rows.find((r) => r.brand === "CAMEL BEER")?.manager, "");
});

test("brand month plan: a missing header or a duplicate line is reported", () => {
  assert.match(parseBrandMonthPlan([["x"]]).errors[0], /header row/);
  assert.match(parseBrandMonthPlan([monthHead, ["A", "B", "C", 1], ["A", "B", "C", 2]]).errors[0], /twice/);
});
