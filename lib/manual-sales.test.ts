import assert from "node:assert/strict";
import test from "node:test";
import { departmentsWithManual, salesWithManual } from "./manual-sales.ts";

test("salesWithManual adds one SELECT per manual row and escapes quotes", () => {
  const sql = salesWithManual("app.sales_clean", [{ date: "2026-10-31", code: "ON", department: "O'Neil", value: 5, cost: 7 }]);
  assert.match(sql, /^\(SELECT \* FROM app\.sales_clean UNION ALL SELECT \(json_populate_record\(NULL::app\.sales_clean, '/);
  assert.match(sql, /"DEPT_CODE":"ON"/);
  assert.match(sql, /"NET_AMOUNT":5,"NET_COST":7\}'\)\)\.\*\)$/);
});

test("salesWithManual leaves the table alone when there are no manual rows", () => {
  assert.equal(salesWithManual("app.sales_clean", []), "app.sales_clean");
});

test("departmentsWithManual adds the manual code and name to the ERP department list", () => {
  const sql = departmentsWithManual([{ date: "2026-10-31", code: "STB", department: "Transind Startbuzz", value: 1, cost: 1 }]);
  assert.match(sql, /UNION ALL SELECT code::text, name::text FROM \(VALUES \('STB', 'Transind Startbuzz'\)\)/);
  assert.equal(departmentsWithManual([]), "public.invs_departments");
});
