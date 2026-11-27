import assert from "node:assert/strict";
import test from "node:test";
import { parseBankPosition, pickBankPositionSheet } from "./bank-position.ts";

const head = ["FACILITY", "LIMIT IN K", "Interest Rate % ", "USED / BALANCE", "Available Balance"];
const grid = [
  [null], ["BANK POSITION AS OF ", null, null, 46351],
  ["DOHA BANK"], ["TRANSIND FOOD - A/c 268555"], head,
  ["OVER DRAFT A/C", 23500000, 0.0375, -20255327.23, 3244672.77],
  ["TERM LOANS A/C", 0, 0.0375, 0, 0], // nothing on it: not kept
  ["TOTAL ===>>>", 1, null, -20255327.23, 3244672.77],
  [], ["DOHA BANK CHAMPION CLEANERS - A/C 346783"], head, ["CURRENT A/C", 0, null, 50835.3, null], ["TOTAL ===>>>", null, null, 50835.3],
  [], ["CHAMPION CLEANERS -A/C 346783"], head, ["CURRENT A/C", 0, null, 50835.3, 50835.3], ["TOTAL ===>>>", null, null, 50835.3], // the same account pasted again
  [], ["DOHA BANK TOTAL"], head, ["OVER DRAFT A/C", 1, 0.035, -9, 9], ["TOTAL ===>>>", 1, null, -9, 9], // roll-up of the above
  [], ["Commercial Bank in Qatar (CBQ)"], ["CBQ-TRANSIND QA05CBQA000000004010049774001"], head,
  ["OVER DRAFT A/C", 20000000, 0.06, -19707715.2, 292284.8],
  ["CBQ-TOP CLEAN 4570561903001"], ["CURRENT A/C", 0, null, 150505, 150505], ["TOTAL ===>>>", 1, null, 1, 1],
  [], ["OTHER ACCOUNT"], head, ["PAVATI CURRENT", 0, 409909.032, 89102.61, 89102.61], ["Transind Total", null, null, 0, -5], ["TOTAL ===>>>", 0, null, 1, 1],
];

test("bank position: accounts are read per bank, zero facilities, roll-ups and repeated accounts are left out", () => {
  const { asOf, rows, errors } = parseBankPosition(grid);
  assert.deepEqual(errors, []);
  assert.equal(asOf, "2026-11-25");
  assert.deepEqual(rows.map((r) => [r.bank, r.facility, r.used]), [
    ["Doha Bank", "OVER DRAFT A/C", -20255327.23], ["Doha Bank", "CURRENT A/C", 50835.3],
    ["CBQ", "OVER DRAFT A/C", -19707715.2], ["CBQ", "CURRENT A/C", 150505], ["Other", "PAVATI CURRENT", 89102.61],
  ]);
  assert.equal(rows[2].account.startsWith("CBQ-TRANSIND"), true);
  assert.equal(rows[3].account, "CBQ-TOP CLEAN 4570561903001");
  assert.equal(rows[4].rate, null); // 409909.032 is not a rate
});

test("bank position: a sheet without a dated heading is refused, and the latest dated sheet is chosen", () => {
  assert.match(parseBankPosition([["BANK POSITION AS OF 16-09-2015"], head]).errors[0], /AS OF/);
  const picked = pickBankPositionSheet([{ name: "old", grid: [["BANK POSITION AS OF 16-09-2015"]] }, { name: "new", grid }]);
  assert.equal(picked?.sheet.name, "new");
});

test("bank position: guarantees and letters of credit are told apart from borrowing and cash", async () => {
  const { bankPositionKind } = await import("./bank-position.ts");
  const kind = (facility: string, used: number) => bankPositionKind({ facility, used });
  assert.equal(kind("LG/TENDER/PERFORMANCE BOND", -70000), "guarantee");
  assert.equal(kind("L/C", -2219136.11), "guarantee");
  assert.equal(kind("L/G", -20570326.21), "guarantee");
  assert.equal(kind("DCF A/C ", -65077757.74), "borrowing");
  assert.equal(kind("OVER DRAFT A/C", -1), "borrowing");
  assert.equal(kind("CURRENT A/C", 50), "cash");
});
