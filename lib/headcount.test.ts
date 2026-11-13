import test from "node:test";
import assert from "node:assert/strict";
import { headcountByCompany, latestHeadcount, readHeadcount } from "./headcount.ts";

test("latest headcount sums every department of the newest month", () => {
  const rows = [
    { month: "2026-10", department: "A", company: "X", count: 5 },
    { month: "2026-11", department: "A", company: "X", count: 3 },
    { month: "2026-11", department: "B", company: "Unassigned", count: 4 },
  ];
  assert.deepEqual(latestHeadcount(rows), { month: "2026-11", total: 7 });
  assert.equal(latestHeadcount([]), null);
});

test("the shipped headcount file is valid and Nov 2026 matches the source sheet less the removed Yellow Transportation (20)", () => {
  assert.deepEqual(latestHeadcount(readHeadcount()), { month: "2026-11", total: 1006 });
});

test("headcount by company groups the latest month only", () => {
  const rows = [
    { month: "2026-10", department: "A", company: "X", count: 9 },
    { month: "2026-11", department: "A", company: "X", count: 3 },
    { month: "2026-11", department: "B", company: "X", count: 4 },
    { month: "2026-11", department: "C", company: "Unassigned", count: 1 },
  ];
  const result = headcountByCompany(rows);
  assert.equal(result.companies.get("X"), 7);
  assert.deepEqual(result.departments("X"), [["B", 4], ["A", 3]]);
});
