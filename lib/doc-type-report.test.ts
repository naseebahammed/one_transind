import assert from "node:assert/strict";
import test from "node:test";
import { fillDocTypes, parseRange } from "./doc-type-report-helpers.ts";

const today = new Date(2026, 10, 27);

test("parseRange defaults to yesterday", () => {
  assert.deepEqual(parseRange(undefined, undefined, today), { from: "2026-11-26", to: "2026-11-26" });
});

test("parseRange keeps a valid range and swaps a reversed one", () => {
  assert.deepEqual(parseRange("2026-11-01", "2026-11-27", today), { from: "2026-11-01", to: "2026-11-27" });
  assert.deepEqual(parseRange("2026-11-27", "2026-11-01", today), { from: "2026-11-01", to: "2026-11-27" });
});

test("parseRange rejects bad dates and falls back to yesterday", () => {
  assert.deepEqual(parseRange("2026-02-30", "x", today), { from: "2026-11-26", to: "2026-11-26" });
});

test("fillDocTypes returns all four types in order with zeros for the missing ones", () => {
  const rows = fillDocTypes([{ docType: "CR", value: -5, cost: -3 }]);
  assert.deepEqual(rows.map((r) => r.docType), ["DO", "IN-DTS", "CR", "DR"]);
  assert.deepEqual(rows[2], { docType: "CR", value: -5, cost: -3 });
  assert.deepEqual(rows[0], { docType: "DO", value: 0, cost: 0 });
});
