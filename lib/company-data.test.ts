import test from "node:test";
import assert from "node:assert/strict";
import { LINES, monthStatuses, parseGrid, profileGaps, templateTitle, type Cell, type FigureSection } from "./company-data.ts";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = new Date(2026, 10, 4);
const expected = { company: "Acme", year: 2026 };

/** A template grid with one filled month: values are keyed by line, every other cell is blank. */
function grid(section: FigureSection, values: Record<string, Cell> = {}, month = 0, lines: readonly string[] = LINES[section], title = templateTitle("Acme", section, 2026)): Cell[][] {
  return [[title], ["Line", ...MON], ...lines.map((l) => [l, ...MON.map((_, i) => (i === month && l in values ? values[l] : null))])];
}
const parse = (section: FigureSection, g: Cell[][]) => parseGrid(section, g, expected, today);
const figures = (r: ReturnType<typeof parseGrid>) => { assert.ok("figures" in r, "error" in r ? r.error : ""); return r.figures; };
const error = (r: ReturnType<typeof parseGrid>) => { assert.ok("error" in r, "expected an error"); return r.error; };

// Assets 100 = liabilities 60 + equity 40.
const balanced = (over: Record<string, Cell> = {}) => ({ ...Object.fromEntries(LINES.balance.map((l) => [l, 0])), "Cash at bank": 100, "Loan balance": 60, Equity: 40, ...over });
const budget = { Revenue: 100, "Direct cost": 60, Overheads: 20 };
const people = { Headcount: 10, "Payroll cost": 5000, Joiners: 1, Leavers: 0 };

test("reads filled months and ignores blank ones", () => {
  const out = figures(parse("budget", grid("budget", budget)));
  assert.equal(out.length, 3);
  assert.ok(out.every((f) => f.month === 0 && f.year === 2026));
  assert.deepEqual(out.find((f) => f.line === "Revenue")?.value, 100);
});

test("keeps a typed zero as a figure", () => {
  assert.equal(figures(parse("budget", grid("budget", { ...budget, Overheads: 0 }))).find((f) => f.line === "Overheads")?.value, 0);
});

test("rejects a file for another company or year", () => {
  assert.match(error(parse("budget", grid("budget", budget, 0, LINES.budget, templateTitle("Other", "budget", 2026)))), /Acme/);
  assert.match(error(parse("budget", grid("budget", budget, 0, LINES.budget, templateTitle("Acme", "budget", 2025)))), /2026/);
  assert.match(error(parse("budget", grid("budget", budget, 0, LINES.budget, templateTitle("Acme", "people", 2026)))), /Budget/);
});

test("accepts a title that differs only by case or spacing", () => {
  figures(parse("budget", grid("budget", budget, 0, LINES.budget, ` ${templateTitle("ACME", "budget", 2026)} `)));
});

test("rejects unknown, missing and duplicate lines", () => {
  assert.match(error(parse("budget", grid("budget", budget, 0, [...LINES.budget, "Bonus"]))), /Bonus/);
  assert.match(error(parse("budget", grid("budget", budget, 0, ["Revenue", "Direct cost"]))), /Overheads/);
  assert.match(error(parse("budget", grid("budget", budget, 0, [...LINES.budget, "Revenue"]))), /Revenue/);
});

test("rejects text that is not a number but reads 1,200", () => {
  const bad = error(parse("budget", grid("budget", { ...budget, Revenue: "abc" })));
  assert.match(bad, /Revenue/); assert.match(bad, /Jan/);
  assert.equal(figures(parse("budget", grid("budget", { ...budget, Revenue: "1,200" }))).find((f) => f.line === "Revenue")?.value, 1200);
});

test("treats a cell of spaces as blank, not 0", () => {
  assert.match(error(parse("budget", grid("budget", { Revenue: "  ", "Direct cost": "", Overheads: null }))), /no figures/i);
});

test("rejects a partly filled month", () => {
  const bad = error(parse("budget", grid("budget", { Revenue: 100 })));
  assert.match(bad, /Jan/); assert.match(bad, /Direct cost/); assert.match(bad, /Overheads/);
});

test("rejects negatives except cash at bank", () => {
  assert.match(error(parse("balance", grid("balance", balanced({ Stock: -1 })))), /Stock/);
  // Overdrawn by 10, with other assets keeping the sheet balanced.
  figures(parse("balance", grid("balance", balanced({ "Cash at bank": -10, "Other assets": 110 }))));
});

test("requires whole numbers for headcount, joiners and leavers", () => {
  assert.match(error(parse("people", grid("people", { ...people, Headcount: 1.5 }))), /Headcount/);
  figures(parse("people", grid("people", { ...people, "Payroll cost": 5000.5 })));
});

test("rejects a balance sheet that does not balance", () => {
  const bad = error(parse("balance", grid("balance", balanced({ Equity: 38 }))));
  assert.match(bad, /Jan/); assert.match(bad, /2/);
  figures(parse("balance", grid("balance", balanced({ Equity: 39 }))));
});

test("excludes the loan repayment memo from the balance check", () => {
  figures(parse("balance", grid("balance", balanced({ "Loan repayments due in 12 months": 999 }))));
});

test("rejects future months for balance and people but not budget", () => {
  assert.match(error(parse("people", grid("people", people, 11))), /Dec/);
  assert.match(error(parse("balance", grid("balance", balanced(), 11))), /Dec/);
  figures(parse("people", grid("people", people, 10))); // the current month is allowed
  figures(parse("budget", grid("budget", budget, 11)));
});

test("rejects a file with no figures", () => {
  assert.match(error(parse("budget", grid("budget"))), /no figures/i);
});

test("rejects a sheet without the template's month headers", () => {
  const g = grid("budget", budget);
  g[1] = ["Line", "A", "B"];
  assert.match(error(parse("budget", g)), /month/i);
});

test("monthStatuses marks months", () => {
  const s = monthStatuses("people", 2026, new Set([0]), today);
  assert.equal(s[0], "Submitted"); assert.equal(s[1], "Not submitted"); assert.equal(s[10], "Not submitted"); assert.equal(s[11], "Not due");
  assert.equal(monthStatuses("budget", 2026, new Set(), today)[11], "Not submitted");
  assert.equal(monthStatuses("pnl", 2027, new Set(), today)[0], "Not due");
  assert.equal(monthStatuses("pnl", 2025, new Set(), today)[11], "Not submitted");
});

test("profileGaps lists blank fields", () => {
  assert.deepEqual(profileGaps({ erp_code: "1" }), []);
  assert.deepEqual(profileGaps({ erp_code: "" }), ["ERP code"]);
});
