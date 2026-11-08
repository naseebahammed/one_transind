// The rules that stop one month being entered in two ways. The client is a stand-in: these check the decision and its inputs, not the SQL against a real database.
import test from "node:test";
import assert from "node:assert/strict";
import { branchClash, monthlySalesClash, takingsClash } from "./figure-rules.ts";

const client = (months: string[]) => {
  const calls: unknown[][] = [];
  return { calls, query: async (_text: string, params: unknown[]) => { calls.push(params); return { rows: months.map((month) => ({ month })) }; } };
};
const periods = ["2026-03-01"];

test("branchClash allows a month with no rows at the other level", async () => {
  assert.equal(await branchClash(client([]), 1, "pnl", periods, null), null);
  assert.equal(await branchClash(client([]), 1, "pnl", periods, 5), null);
});

test("branchClash looks at the opposite level and names the month", async () => {
  const whole = client(["Mar 2026"]), branch = client(["Mar 2026"]);
  assert.match((await branchClash(whole, 1, "expenses", periods, null))!, /Mar 2026 is already entered per branch/);
  assert.match((await branchClash(branch, 1, "expenses", periods, 5))!, /Mar 2026 is already entered for the whole company/);
  assert.deepEqual(whole.calls[0], [1, "expenses", periods, true]);
  assert.deepEqual(branch.calls[0], [1, "expenses", periods, false]);
});

test("the retail rules only speak up when the other source has the month", async () => {
  assert.equal(await monthlySalesClash(client([]), 1, periods), null);
  assert.equal(await takingsClash(client([]), 1, periods), null);
  assert.match((await monthlySalesClash(client(["Mar 2026"]), 1, periods))!, /already has daily takings/);
  assert.match((await takingsClash(client(["Mar 2026"]), 1, periods))!, /already has a monthly sales figure/);
});
