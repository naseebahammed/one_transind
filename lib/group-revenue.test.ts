import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompanyMonthlySeries,
  computeGroupMonthlyRevenue,
  computeGroupMonthlyTargetsMillions,
} from "./group-revenue.ts";

test("computeGroupMonthlyRevenue combines ERP Trading months with active non-Trading subsidiaries", () => {
  const subsidiaryRows = [
    { companyId: 3, year: 2026, month: 0, amount: 450_000 }, // Al Manzil Jan
    { companyId: 3, year: 2026, month: 1, amount: 480_000 }, // Al Manzil Feb
    { companyId: 14, year: 2026, month: 0, amount: 150_000 }, // Burger Stop Jan
    { companyId: 13, year: 2026, month: 0, amount: 999_999 }, // Trading (excluded via nonTradingCompanyIds)
  ];

  assert.equal(buildCompanyMonthlySeries(subsidiaryRows, 3, 2026)[0], 450_000);
  assert.equal(buildCompanyMonthlySeries(subsidiaryRows, 3, 2026)[1], 480_000);

  const group = computeGroupMonthlyRevenue({
    erpMonths: [
      { month: 1, value: 3_000_000 },
      { month: 2, value: 3_200_000 },
    ],
    throughMonth: 1,
    nonTradingCompanyIds: [3, 14],
    subsidiaryRows,
    year: 2026,
  });

  assert.deepEqual(group, [3_600_000, 3_680_000]);
});

test("computeGroupMonthlyTargetsMillions returns empty array when zero and QAR M values when targets exist", () => {
  assert.deepEqual(
    computeGroupMonthlyTargetsMillions({
      throughMonth: 2,
      year: 2026,
      erpTargets: [],
      subsidiaryBudgetMonths: Array<number>(12).fill(0),
    }),
    [],
  );

  const targets = computeGroupMonthlyTargetsMillions({
    throughMonth: 1,
    year: 2026,
    erpTargets: [
      { year: 2026, month: 0, target: 2_500_000 },
      { year: 2026, month: 1, target: 2_700_000 },
    ],
    subsidiaryBudgetMonths: [500_000, 300_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  assert.deepEqual(targets, [3, 3]);
});

