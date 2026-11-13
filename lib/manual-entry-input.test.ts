import assert from "node:assert/strict";
import test from "node:test";
import {
  isManualTab,
  parseIsoDate,
  parseManualCogs,
  parseManualCustoms,
  parseManualDailyStay,
  parseManualDailyTakings,
  parseManualEmployee,
  parseManualMonthlyFigures,
  parseManualOverdueInvoice,
  parseManualPnl,
  parseManualReceivablesSnapshot,
  parseManualSalesIndicators,
  parseManualSalesTarget,
  parseManualUnitTypes,
  parseYearMonth,
} from "./manual-entry-input.ts";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

test("parseIsoDate and parseYearMonth validate calendar bounds cleanly", () => {
  assert.equal(parseIsoDate("2026-11-12"), "2026-11-12");
  assert.equal(parseIsoDate("2026-02-30"), null);
  assert.equal(parseIsoDate("12/11/2026"), null);
  assert.deepEqual(parseYearMonth("2026", "0"), { year: 2026, month: 0, period: "2026-01-01" });
  assert.equal(parseYearMonth("2026", "12"), null);
  assert.equal(isManualTab("pnl"), true);
  assert.equal(isManualTab("unknown"), false);
});

test("parseManualPnl accepts signed revenue and cost amounts and validates account selection", () => {
  const ok = parseManualPnl(form({ companyId: "2", year: "2026", month: "9", account: "STAFF COST|Staff Salary", value: "-45,000.50" }));
  assert.ok("data" in ok);
  assert.deepEqual(ok.data, { companyId: 2, branchId: null, year: 2026, month: 9, main: "STAFF COST", sub: "Staff Salary", value: -45000.5 });

  const missingAccount = parseManualPnl(form({ companyId: "2", year: "2026", month: "9", value: "100" }));
  assert.ok("error" in missingAccount);
});

test("parseManualMonthlyFigures enforces whole-number headcount and future-month restrictions", () => {
  const today = new Date("2026-11-12T08:00:00Z");
  const peopleOk = parseManualMonthlyFigures(
    form({
      section: "people", companyId: "1", year: "2026", month: "9",
      line_Headcount: "42", "line_Payroll cost": "95000", line_Joiners: "2", line_Leavers: "1",
    }),
    today,
  );
  assert.ok("data" in peopleOk);
  assert.equal(peopleOk.data.entries.length, 4);

  const fractional = parseManualMonthlyFigures(
    form({
      section: "people", companyId: "1", year: "2026", month: "9",
      line_Headcount: "42.5", "line_Payroll cost": "95000", line_Joiners: "2", line_Leavers: "1",
    }),
    today,
  );
  assert.ok("error" in fractional);

  const futureActual = parseManualMonthlyFigures(
    form({ section: "expenses", companyId: "1", year: "2026", month: "11", line_Expenses: "1000" }),
    today,
  );
  assert.ok("error" in futureActual);

  const futureBudget = parseManualMonthlyFigures(
    form({
      section: "budget", companyId: "1", year: "2027", month: "0",
      line_Revenue: "150000", "line_Direct cost": "50000", line_Overheads: "30000",
    }),
    today,
  );
  assert.ok("data" in futureBudget);
});

test("parseManualDailyStay checks room occupancy against available and total rooms", () => {
  const valid = parseManualDailyStay(
    form({
      companyId: "3", date: "2026-10-01", long_guests: "80", long_rate: "200", long_total: "16000",
      short_guests: "5", short_rate: "250", short_total: "1250", rooms_occupied: "85",
      room_revenue: "17250", other_revenue: "500", rooms_available: "87",
    }),
    87,
  );
  assert.ok("data" in valid);
  assert.equal(valid.data.rooms_occupied, 85);

  const overOccupied = parseManualDailyStay(form({ companyId: "3", date: "2026-10-01", rooms_occupied: "90", rooms_available: "87" }), 87);
  assert.ok("error" in overOccupied);

  const overPropertyRooms = parseManualDailyStay(form({ companyId: "3", date: "2026-10-01", rooms_occupied: "80", rooms_available: "120" }), 87);
  assert.ok("error" in overPropertyRooms);
});

test("parseManualUnitTypes, parseManualDailyTakings, and parseManualCogs normalize lines and signs", () => {
  const units = parseManualUnitTypes(form({ companyId: "1", year: "2026", month: "9", unitType: "1 BHK", unit_Available: "60", "unit_Room revenue": "9500" }));
  assert.ok("data" in units);
  assert.deepEqual(units.data.entries, [{ line: "Available", value: 60 }, { line: "Room revenue", value: 9500 }]);

  const takings = parseManualDailyTakings(form({ companyId: "4", branchId: "10", date: "2026-10-15", "ch_Cash sales": "1200", customChannel: "Bank deposit", customValue: "1200" }));
  assert.ok("data" in takings);
  assert.deepEqual(takings.data.entries, [{ line: "Cash sales", value: 1200 }, { line: "Bank deposits", value: 1200 }]);

  const cogs = parseManualCogs(form({ companyId: "4", year: "2026", month: "9", "cogs_Gross sales": "50000", cogs_Discount: "2000", "cogs_Net sales": "48000", cogs_COGS: "18000" }));
  assert.ok("data" in cogs);
  assert.deepEqual(cogs.data.entries, [
    { line: "Gross sales", value: 50000 },
    { line: "Discount", value: -2000 },
    { line: "Net sales", value: 48000 },
    { line: "COGS", value: -18000 },
  ]);
});

test("parseManualSalesTarget, parseManualSalesIndicators, Finance, HR, and Logistics validators check required fields and dates", () => {
  const target = parseManualSalesTarget(form({ code: "D01", year: "2026", month: "10", target: "250,000" }));
  assert.ok("data" in target);
  assert.equal(target.data.target, 250000);

  const ind = parseManualSalesIndicators(form({ departmentCode: "", year: "2026", month: "10", ind_van_sales: "120000", ind_price_realisation: "98.4" }));
  assert.ok("data" in ind);
  assert.equal(ind.data.entries.length, 2);

  const ar = parseManualReceivablesSnapshot(form({ asOf: "2026-11-10", dsoDays: "42.5", notDue: "100000", over90: "25000" }));
  assert.ok("data" in ar);
  assert.equal(ar.data.over90, 25000);

  const inv = parseManualOverdueInvoice(form({ invoiceNo: "INV-101", accountName: "Al Meera", dueDate: "2026-09-01", amount: "15000", balance: "5000" }));
  assert.ok("data" in inv);
  assert.equal(inv.data.status, "Overdue");

  const badEmp = parseManualEmployee(form({ id: "E100", name: "Ali", joined: "2026-05-10", left: "2026-04-01" }));
  assert.ok("error" in badEmp);

  const customs = parseManualCustoms(form({ bolNo: "BOL-7788", customer: "Transind Trading", port: "Hamad Port", eta: "2026-11-20" }));
  assert.ok("data" in customs);
  assert.equal(customs.data.bolNo, "BOL-7788");
});

