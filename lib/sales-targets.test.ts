import assert from "node:assert/strict";
import test from "node:test";
import { computeTargetAttainment, departmentYtdTargets, resolveSectorIndicators } from "./sales-targets.ts";

test("computeTargetAttainment returns percentage when target is positive and null otherwise", () => {
  assert.equal(computeTargetAttainment(850_000, 1_000_000), 85);
  assert.equal(computeTargetAttainment(1_250_000, 1_000_000), 125);
  assert.equal(computeTargetAttainment(500_000, 0), null);
  assert.equal(computeTargetAttainment(500_000, null), null);
});

test("departmentYtdTargets sums monthly targets through the selected month per department", () => {
  const totals = departmentYtdTargets(
    [
      { code: "D01", year: 2026, month: 0, period: "2026-01-01", target: 100_000 },
      { code: "D01", year: 2026, month: 1, period: "2026-02-01", target: 150_000 },
      { code: "D01", year: 2026, month: 5, period: "2026-06-01", target: 200_000 },
      { code: "D02", year: 2026, month: 0, period: "2026-01-01", target: 80_000 },
    ],
    2026,
    2,
  );
  assert.equal(totals.get("D01"), 250_000);
  assert.equal(totals.get("D02"), 80_000);
});

test("resolveSectorIndicators prefers group overrides on All view and sums or averages department entries", () => {
  const rows = [
    { departmentCode: "D01", period: "2026-11-01", indicator: "van_sales" as const, value: 300_000 },
    { departmentCode: "D02", period: "2026-11-01", indicator: "van_sales" as const, value: 200_000 },
    { departmentCode: "D01", period: "2026-11-01", indicator: "price_realisation" as const, value: 96 },
    { departmentCode: "D02", period: "2026-11-01", indicator: "price_realisation" as const, value: 98 },
    { departmentCode: "", period: "2026-11-01", indicator: "promo_uplift" as const, value: 12.5 },
  ];

  const allView = resolveSectorIndicators(rows, "");
  assert.equal(allView.get("van_sales"), 500_000);
  assert.equal(allView.get("price_realisation"), 97);
  assert.equal(allView.get("promo_uplift"), 12.5);

  const deptView = resolveSectorIndicators(rows, "D01");
  assert.equal(deptView.get("van_sales"), 300_000);
  assert.equal(deptView.get("promo_uplift"), undefined);
});

