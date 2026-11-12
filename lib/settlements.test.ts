import assert from "node:assert/strict";
import test from "node:test";
import { cleanDivision, parseSettlements, summarizeSettlements } from "./settlements.ts";

const header = ["UPLOAD  DATE ", "EMP # ", "EMP NAME ", "DIVISION", "SETTLEMENT TYPE ", "ACCOUNT", "AMOUNT ", "SCHEDULED DATE", "CARD TYPE"];
const row = (date: string, id: number, division: string, type: string, amount: number | string) => [date, id, "A B", division, type, 268555, amount, date, "BANK"];

test("parseSettlements reads the ledger, tidies divisions and types, and refuses bad rows", () => {
  const ok = parseSettlements([header, row("2024-01-02T00:00:00.000Z", 1, "Cococola ", "LE ", 10.456)]);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual([ok.settlements[0].division, ok.settlements[0].type, ok.settlements[0].amount, ok.settlements[0].uploadDate], ["COCA COLA", "LE", 10.46, "2024-01-02"]);
  assert.equal(parseSettlements([header, row("oops", 1, "FOOD NEW", "AL", 5)]).errors.length, 1);
  assert.equal(parseSettlements([header, row("2024-01-02T00:00:00.000Z", 1, "FOOD NEW", "AL", "x")]).errors.length, 1);
  assert.match(parseSettlements([["UPLOAD DATE", "EMP #"]]).errors[0], /Missing columns/);
  assert.match(parseSettlements([["x"]]).errors[0], /header/);
  assert.equal(cleanDivision(null), "UNSPECIFIED");
});

test("summarizeSettlements totals one year by division, type and month", () => {
  const { settlements } = parseSettlements([header, row("2024-01-02T00:00:00.000Z", 1, "FOOD NEW", "AL", 100), row("2024-01-09T00:00:00.000Z", 1, "FOOD NEW", "FF", 50), row("2024-03-01T00:00:00.000Z", 2, "TOP CLEAN", "AL", 25), row("2025-01-01T00:00:00.000Z", 3, "TOP CLEAN", "AL", 999)]);
  const s = summarizeSettlements(settlements, 2024);
  assert.deepEqual([s.payments, s.people, s.total], [3, 2, 175]);
  assert.deepEqual(s.byDivision.map((d) => [d.name, d.payments, d.people, d.total]), [["FOOD NEW", 2, 1, 150], ["TOP CLEAN", 1, 1, 25]]);
  assert.deepEqual([s.byMonth[0], s.byMonth[2]], [150, 25]);
});
