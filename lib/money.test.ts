import assert from "node:assert/strict";
import test from "node:test";
import { parseMoneyString, roundMoney, sumMoney } from "./money.ts";

test("roundMoney rounds halfway decimals away from zero instead of drifting downward in binary float", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(roundMoney(35.855), 35.86);
  assert.equal(roundMoney(-35.855), -35.86);
  assert.equal(roundMoney(5.126), 5.13);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(Object.is(roundMoney(-0), 0), true);
  assert.equal(roundMoney(999_999_999_999.99), 999_999_999_999.99);
  assert.equal(roundMoney(1_000_000_000_000), 1_000_000_000_000);
});

test("parseMoneyString rounds decimal text directly without intermediate binary float loss", () => {
  assert.equal(parseMoneyString("1,234.505"), 1234.51);
  assert.equal(parseMoneyString("(1.005)"), -1.01);
  assert.equal(parseMoneyString("-35.855"), -35.86);
  assert.equal(parseMoneyString(".5"), 0.5);
  assert.equal(parseMoneyString("1e3"), 1000);
  assert.equal(parseMoneyString("((-5))"), null);
  assert.equal(parseMoneyString("abc"), null);
  assert.equal(parseMoneyString(""), null);
});

test("sumMoney sums QAR figures in minor units without float accumulation drift", () => {
  assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
  assert.equal(sumMoney([110.5, 333, 1490, 34.2, -34.2]), 1933.5);
  assert.equal(Object.is(sumMoney([10, -10]), 0), true);
});
