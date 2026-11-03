import test from "node:test";
import assert from "node:assert/strict";
import { periodOf } from "./period-calc.ts";

test("last day of a month: that month is complete", () => {
  const r = periodOf("2026-05-31");
  assert.deepEqual([r.cur, r.before, r.year, r.month], ["2026-05", "2026-04", 2026, 4]);
});

test("mid-month: the month before is the latest complete one", () => {
  assert.equal(periodOf("2026-06-12").cur, "2026-05");
  assert.equal(periodOf("2026-01-10").cur, "2025-12");
});

test("SALES_PERIOD pins the month, even on an empty table", () => {
  assert.equal(periodOf("2026-06-12", "2026-03").cur, "2026-03");
  assert.equal(periodOf(null, "2026-03").before, "2026-02");
});

test("empty table and bad SALES_PERIOD give a clear error", () => {
  assert.throws(() => periodOf(null), /no rows/);
  assert.throws(() => periodOf("2026-06-12", "2026-13"), /SALES_PERIOD/);
});
