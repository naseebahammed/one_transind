import assert from "node:assert/strict";
import test from "node:test";
import { branchSummary, deliveryAppTotals, receiptTable } from "./receipts.ts";

const day = (date: string, v: Record<string, number>) => Object.entries(v).map(([line, value]) => ({ date, line, value }));

test("receiptTable: gross sales leaves out bank deposits only (1 Feb sheet = 2864.50)", () => {
  const rows = day("2026-02-01", { "Bank deposits": 110.5, "Cash sales": 110.5, "Credit card sales": 333, "Talabat cash": 0, "Talabat credit card": 1490, "Talabat discount": 0, "Snoonu cash": 0, Rafeeq: 204, Snoonu: 28, Deliveroo: 0, Keeta: 699 });
  const t = receiptTable(rows, 2026, 1);
  assert.equal(t.days.length, 28);
  assert.equal(t.days[0].gross, 2864.5);
  assert.equal(t.days[1].gross, null, "a day with no figures is blank, not 0");
});

test("receiptTable: totals add up per column and an unknown channel still appears", () => {
  const rows = [...day("2026-02-01", { Keeta: 10, Cash: 5 }), ...day("2026-02-02", { Keeta: 20, "Talabat discount": 4 })];
  const t = receiptTable(rows, 2026, 1);
  assert.equal(t.totals.Keeta, 30);
  assert.equal(t.totals["Talabat discount"], 4);
  assert.equal(t.gross, 39); // the discount counts: the sheet's 12 Feb gross 5608.90 includes its 34.20
  assert.ok(t.columns.includes("Cash"));
});

test("branchSummary: delivery apps are gross minus cash and card; days counts days with figures", () => {
  const rows = day("2026-02-01", { "Bank deposits": 110.5, "Cash sales": 110.5, "Credit card sales": 333, "Talabat credit card": 1490, Rafeeq: 204, Snoonu: 28, Keeta: 699 });
  const s = branchSummary(receiptTable(rows, 2026, 1));
  assert.deepEqual(s, { gross: 2864.5, cash: 110.5, card: 333, deliveryApps: 2421, days: 1 });
});

test("receiptTable: excludes singular or uppercase bank deposit variants from gross and sums decimals without float drift", () => {
  const rows = [
    ...day("2026-02-01", { "Bank deposit": 50, "Cash sales": 0.1, "Credit card sales": 0.2 }),
    ...day("2026-02-02", { "BANK DEPOSITS": 25, "Cash sales": 1.005 }),
  ];
  const t = receiptTable(rows, 2026, 1);
  assert.equal(t.days[0].gross, 0.3);
  assert.equal(t.totals["Bank deposits"], 75);
  assert.equal(t.gross, 1.31);
});

test("deliveryAppTotals: groups an app's lines under its name and leaves out cash, card and bank deposits", () => {
  const rows = day("2026-02-01", { "Bank deposits": 110.5, "Cash sales": 110.5, "Credit card sales": 333, "Talabat credit card": 1490, "Talabat discount": -90, "Snoonu cash": 10, Snoonu: 28, Rafeeq: 204, Deliveroo: 0 });
  assert.deepEqual(deliveryAppTotals(receiptTable(rows, 2026, 1)), { Talabat: 1400, Snoonu: 38, Rafeeq: 204 });
});

test("a heading that is just Cash counts as the shop's cash, not as a delivery app", () => {
  const table = receiptTable(day("2026-02-01", { "Cash sales": 100, Cash: 20, "Credit card sales": 50, Keeta: 30 }), 2026, 1);
  assert.equal(branchSummary(table).cash, 120);
  assert.deepEqual(deliveryAppTotals(table), { Keeta: 30 });
});

test("deliveryAppTotals: the same app typed in different cases is one app", () => {
  const rows = day("2026-02-01", { Keeta: 10, KEETA: 5, "snoonu cash": 2, Snoonu: 3 });
  assert.deepEqual(deliveryAppTotals(receiptTable(rows, 2026, 1)), { Keeta: 15, Snoonu: 5 });
});
