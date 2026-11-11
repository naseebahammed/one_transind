import assert from "node:assert/strict";
import test from "node:test";
import { departmentMovements, mergeEmployees, monthlyMovements, parseEmployees } from "./employees.ts";

const header = ["Emp ID", "Employee Name", "Joining Date", "Service Period", "Department ", "Designation", "NATIONALITY_DESC", "RESIGN_DATE"];
const row = (id: string, joined: string, left: string) => [id, "A B", joined, "x", "FOOD", "HELPER", "INDIA", left];

test("parseEmployees skips title rows, reads (blank) as still employed, and reports bad rows", () => {
  const ok = parseEmployees([[null], header, row("1", "2024-05-01T00:00:00.000Z", "(blank)"), row("2", "2024-05-01T00:00:00.000Z", "2024-05-31T00:00:00.000Z")]);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.employees.map((e) => [e.id, e.joined, e.left]), [["1", "2024-05-01", null], ["2", "2024-05-01", "2024-05-31"]]);
  assert.equal(parseEmployees([header, row("3", "oops", "(blank)")]).errors.length, 1);
  const reversed = parseEmployees([header, row("4", "2024-05-10T00:00:00.000Z", "2024-05-01T00:00:00.000Z")]);
  assert.deepEqual([reversed.employees.length, reversed.errors.length, reversed.skipped.length], [0, 0, 1]);
  assert.match(parseEmployees([["Emp ID", "Employee Name"]]).errors[0], /Missing columns/);
  assert.match(parseEmployees([["x"]]).errors[0], /header/);
});

test("monthlyMovements and departmentMovements count by calendar year", () => {
  const list = [
    { department: "FOOD", joined: "2025-01-10", left: "2025-03-01" },
    { department: "FOOD", joined: "2024-12-31", left: null },
    { department: "COLA", joined: "2025-03-05", left: null },
  ];
  const m = monthlyMovements(list, 2025);
  assert.deepEqual([m.joiners[0], m.joiners[2], m.leavers[2]], [1, 1, 1]);
  assert.deepEqual(departmentMovements(list, 2025), [{ department: "FOOD", joiners: 1, leavers: 1 }, { department: "COLA", joiners: 1, leavers: 0 }]);
});

test("mergeEmployees keeps one row per ID and the leave date from either file", () => {
  const e = { id: "1", name: "A", department: "", designation: "", nationality: "", joined: "2024-01-01" };
  const merged = mergeEmployees([{ ...e, left: "2024-05-31" }, { ...e, left: null }, { ...e, id: "2", left: null }]);
  assert.deepEqual(merged.map((x) => [x.id, x.left]), [["1", "2024-05-31"], ["2", null]]);
});

test("parseEmployees validates real calendar dates and reads DD/MM/YYYY and Excel serial numbers", () => {
  assert.equal(parseEmployees([header, row("9", "2024-02-31", "(blank)")]).errors.length, 1);
  assert.equal(parseEmployees([header, row("9", "05/25/2024", "(blank)")]).errors.length, 1);
  const ok = parseEmployees([header, ["10", "A B", "15/05/2024", "x", "FOOD", "HELPER", "INDIA", "(blank)"], ["11", "C D", 45413, "x", "FOOD", "HELPER", "INDIA", "(blank)"]]);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.employees.map((e) => [e.id, e.joined]), [["10", "2024-05-15"], ["11", "2024-05-01"]]);
});

test("mergeEmployees clears stale leave dates on re-hire regardless of file order", () => {
  const base = { id: "77", name: "Rehired Staff", department: "FOOD", designation: "COOK", nationality: "INDIA" };
  const oldStint = { ...base, joined: "2023-01-10", left: "2024-06-30" };
  const rehire = { ...base, joined: "2025-02-01", left: null };
  assert.deepEqual(mergeEmployees([oldStint, rehire]), [rehire]);
  assert.deepEqual(mergeEmployees([rehire, oldStint]), [rehire]);
});
