import test from "node:test";
import assert from "node:assert/strict";
import { periodOf } from "./period-calc.ts";

test("last day of a month: that month, all its days", () => {
  const r = periodOf("2026-05-31");
  assert.deepEqual([r.cur, r.before, r.year, r.month, r.day], ["2026-05", "2026-04", 2026, 4, 31]);
});

test("mid-month: this month is the month of the latest date, up to that day", () => {
  const r = periodOf("2026-11-10");
  assert.deepEqual([r.cur, r.before, r.month, r.day], ["2026-11", "2026-10", 10, 10]);
  assert.deepEqual([periodOf("2026-01-10").cur, periodOf("2026-01-10").before], ["2026-01", "2025-12"]);
});

test("empty table gives a clear error", () => {
  assert.throws(() => periodOf(null), /no rows/);
});
