import assert from "node:assert/strict";
import test from "node:test";
import {
  combineReceivablesRollup,
  computeElapsedYearDays,
  computeErpDsoDays,
  type ErpReceivablesInput,
} from "./receivables-rollup.ts";

const sampleErp = (overrides: Partial<ErpReceivablesInput> = {}): ErpReceivablesInput => ({
  connected: true,
  asOf: "2026-11-12",
  notDue: 2_000_000,
  days1To30: 1_200_000,
  days31To60: 600_000,
  days61To90: 300_000,
  over90: 400_000,
  total: 4_500_000,
  overdueInvoices: [
    {
      invoiceNo: "INV-1001",
      accountName: "AL MEERA CONSUMER GOODS",
      dueDate: "2026-07-15",
      amount: 250_000,
      balance: 250_000,
      daysOverdue: 120,
      status: "Over 90d",
    },
  ],
  ...overrides,
});

test("computeElapsedYearDays and computeErpDsoDays compute calendar days and DSO accurately", () => {
  assert.equal(computeElapsedYearDays(2026, 0, 1), 1);
  assert.equal(computeElapsedYearDays(2026, 0, 31), 31);
  assert.equal(computeErpDsoDays(4_500_000, 45_000_000, 300), 30);
  assert.equal(computeErpDsoDays(4_500_000, 0, 300), null);
  assert.equal(computeErpDsoDays(-10, 45_000_000, 300), null);
});

test("combineReceivablesRollup returns null when neither ERP nor manual snapshots exist", () => {
  const res = combineReceivablesRollup({
    erp: sampleErp({ connected: false, total: 0, notDue: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0, overdueInvoices: [] }),
    erpDsoDays: null,
    snapshots: [],
    manualOverdue: [],
    tradingCompanyIds: new Set([13]),
  });
  assert.equal(res, null);
});

test("combineReceivablesRollup labels Step 1 ERP-only receivables clearly", () => {
  const res = combineReceivablesRollup({
    erp: sampleErp(),
    erpDsoDays: 42.5,
    snapshots: [],
    manualOverdue: [],
    tradingCompanyIds: new Set([13]),
  });
  assert.ok(res);
  assert.equal(res.sourceLabel, "ERP Trading receivables");
  assert.equal(res.total, 4_500_000);
  assert.equal(res.over90, 400_000);
  assert.equal(res.dsoDays, 42.5);
  assert.equal(res.overdueInvoices.length, 1);
  assert.equal(res.overdueInvoices[0].invoiceNo, "INV-1001");
});

test("combineReceivablesRollup adds Step 2 non-ERP subsidiaries while skipping Trading company duplicates", () => {
  const res = combineReceivablesRollup({
    erp: sampleErp(),
    erpDsoDays: 40,
    snapshots: [
      {
        id: 1,
        companyId: 13, // Transind Trading (must be skipped when ERP is connected)
        companyName: "Transind Trading",
        asOf: "2026-11-10",
        dsoDays: 50,
        notDue: 999_999,
        days1To30: 0,
        days31To60: 0,
        days61To90: 0,
        over90: 0,
        total: 999_999,
      },
      {
        id: 2,
        companyId: 3, // Al Manzil Residence & Suites
        companyName: "Al Manzil Residence & Suites",
        asOf: "2026-11-12",
        dsoDays: 20,
        notDue: 300_000,
        days1To30: 100_000,
        days31To60: 50_000,
        days61To90: 25_000,
        over90: 25_000,
        total: 500_000,
      },
    ],
    manualOverdue: [
      {
        id: 10,
        invoiceNo: "INV-1001", // overrides status of ERP invoice INV-1001
        accountName: "AL MEERA CONSUMER GOODS",
        companyId: 13,
        companyName: "Transind Trading",
        dueDate: "2026-07-15",
        amount: 250_000,
        balance: 250_000,
        status: "Disputed",
      },
      {
        id: 11,
        invoiceNo: "AM-204",
        accountName: "CORPORATE STAY ACCOUNT",
        companyId: 3,
        companyName: "Al Manzil Residence & Suites",
        dueDate: "2026-09-01",
        amount: 80_000,
        balance: 60_000,
        status: "Overdue",
      },
    ],
    tradingCompanyIds: new Set([13]),
  });

  assert.ok(res);
  assert.equal(res.sourceLabel, "ERP Trading + 1 subsidiary");
  assert.equal(res.subsidiaryCount, 1);
  assert.equal(res.total, 5_000_000);
  assert.equal(res.over90, 425_000);
  // Weighted DSO: (4.5M * 40 + 0.5M * 20) / 5.0M = 190M / 5M = 38.0 days
  assert.equal(res.dsoDays, 38);
  assert.equal(res.overdueInvoices.length, 2);
  assert.equal(res.overdueInvoices[0].status, "Disputed");
  assert.equal(res.overdueInvoices[1].invoiceNo, "AM-204");
});

