import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySalesChannel,
  mergeSalesSectorIndicators,
  resolveDepartmentTargetsWithFallback,
} from "./sales-indicators.ts";

test("classifySalesChannel maps ERP customer categories, DTS invoices, and DSR channels accurately", () => {
  assert.equal(classifySalesChannel({ custCategory: "HORECA - HOTELS", docType: "IN-OT" }), "horeca");
  assert.equal(classifySalesChannel({ custCategory: "WHOLESALE MARKET", docType: "IN-OT" }), "wholesale");
  assert.equal(classifySalesChannel({ custCategory: "HYPERMARKET", docType: "IN-OT" }), "key_accounts");
  assert.equal(classifySalesChannel({ custCategory: "GENERAL", assignmentChannel: "SAJID - MT", docType: "IN-OT" }), "key_accounts");
  assert.equal(classifySalesChannel({ custCategory: null, docType: "IN-DTS" }), "van_sales");
  assert.equal(classifySalesChannel({ custCategory: "BAQALA / GROCERY", docType: "IN-OT" }), "van_sales");
  assert.equal(classifySalesChannel({ custCategory: "UNCLASSIFIED", docType: "IN-OT", salesmanCategory: "3--DTS" }), "van_sales");
  assert.equal(classifySalesChannel({ custCategory: "OTHER", docType: "IN-OT" }), null);
});

test("mergeSalesSectorIndicators lets manual overrides win while retaining computed channels and variances", () => {
  const computed = {
    van_sales: 1_200_000,
    key_accounts: 2_400_000,
    horeca: 650_000,
    wholesale: 410_000,
    out_of_stock_loss: 38_500,
  };
  const manual = new Map([
    ["van_sales" as const, 1_250_000],
    ["price_realisation" as const, 97.4],
    ["promo_uplift" as const, 11.2],
  ]);
  const merged = mergeSalesSectorIndicators(computed, manual);
  assert.equal(merged.get("van_sales"), 1_250_000);
  assert.equal(merged.get("key_accounts"), 2_400_000);
  assert.equal(merged.get("out_of_stock_loss"), 38_500);
  assert.equal(merged.get("price_realisation"), 97.4);
  assert.equal(merged.get("promo_uplift"), 11.2);
});

test("resolveDepartmentTargetsWithFallback uses DSR assignments when explicit department targets are absent", () => {
  const result = resolveDepartmentTargetsWithFallback(
    [{ code: "FNB", year: 2026, month: 0, period: "2026-01-01", target: 900_000 }],
    [
      { code: "FNB", year: 2026, month: 0, target: 850_000 }, // overridden by explicit
      { code: "FNB", year: 2026, month: 1, target: 920_000 }, // kept as fallback
      { code: "FDD", year: 2026, month: 0, target: 500_000 }, // kept as fallback
    ],
  );
  assert.deepEqual(result, [
    { code: "FDD", year: 2026, month: 0, period: "2026-01-01", target: 500_000 },
    { code: "FNB", year: 2026, month: 0, period: "2026-01-01", target: 900_000 },
    { code: "FNB", year: 2026, month: 1, period: "2026-02-01", target: 920_000 },
  ]);
});

