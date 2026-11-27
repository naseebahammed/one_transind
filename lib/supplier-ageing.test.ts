import assert from "node:assert/strict";
import test from "node:test";
import { parseSupplierAgeing } from "./supplier-ageing.ts";

const head = ["Account No", "Account Name", "1-30", "31-60", "61-90", "91-120", "121-180", "181-360", "Above 1yr", "Grand Total"];

test("supplier ageing: buckets are read by heading, #N/A counts as 0, the total is recomputed", () => {
  const { rows, errors } = parseSupplierAgeing([
    ["Company", "(All)"], [], head,
    ["S200502", " ARAB  CENTER ", -250, 0, "#N/A", null, 0, 0, 0, 999],
    ["S000000", "SALARY PAYABLE", 0, 581, -581, 17566, -6457, 13736, -24845, 0],
    ["Grand Total", "", 1, 1, 1, 1, 1, 1, 1, 7],
  ]);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "ARAB CENTER");
  assert.equal(rows[0].total, -250);
  assert.equal(rows[1].total, 0);
});

test("supplier ageing: a bad amount or duplicate account is reported, a missing header refuses the file", () => {
  const bad = parseSupplierAgeing([head, ["A1", "X", "abc", 0, 0, 0, 0, 0, 0], ["A2", "Y", 1, 0, 0, 0, 0, 0, 0], ["A2", "Y", 1, 0, 0, 0, 0, 0, 0]]);
  assert.equal(bad.rows.length, 1);
  assert.match(bad.errors[0], /not a number/);
  assert.match(bad.errors[1], /twice/);
  assert.match(parseSupplierAgeing([["x"]]).errors[0], /header row/);
});
