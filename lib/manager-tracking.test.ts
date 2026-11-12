import assert from "node:assert/strict";
import test from "node:test";
import { targetManager, trackManagers, workingDaysThrough } from "./manager-tracking.ts";

test("November 2026 has 26 working days (Fridays off) and 10 of them are gone by the 11th", () => {
  assert.equal(workingDaysThrough(2026, 10, 30), 26);
  assert.equal(workingDaysThrough(2026, 10, 11), 10);
});

test("trackManagers matches the workbook: Sajid RV 13.9145M budget, 5.35M covered", () => {
  const r = trackManagers([{ manager: "SAJID & MINHAJ", target: 13_914_500 }], [{ manager: "SAJID", channel: "SAJID - MT", sales: 4_201_141.17 }], 2026, 10, 11);
  assert.equal(r.workingDays, 26);
  assert.equal(r.daysLeft, 16);
  const [s] = r.rows;
  assert.equal(s.balance, 9_713_358.83);
  assert.equal(s.dailyRequired, 607_084.93);
  assert.equal(s.achievedPct, 30.19);
});

test("no target gives no percentages, exceeded target needs 0 a day, end of month gives null", () => {
  const r = trackManagers([{ manager: "A", target: 100 }], [{ manager: "A", channel: null, sales: 150 }, { manager: null, channel: null, sales: 5 }], 2026, 10, 11);
  assert.equal(r.rows.find((x) => x.manager === "A")?.dailyRequired, 0);
  const none = r.rows.find((x) => x.manager === "Unassigned");
  assert.equal(none?.achievedPct, null);
  assert.equal(trackManagers([{ manager: "A", target: 100 }], [], 2026, 10, 30).rows[0].dailyRequired, null);
});

test("targetManager maps salesmen to the team names the targets use, splitting Saleem by channel", () => {
  assert.equal(targetManager("SAJID", "SAJID - MT"), "SAJID & MINHAJ");
  assert.equal(targetManager("RAYMOND", "RAYMOND-MT/SS/ONLINE"), "RAYMOND");
  assert.equal(targetManager("SALEEM", "SALEEM - HRC"), "SALEEM HRC & WS");
  assert.equal(targetManager("SALEEM", "SALEEM - WS"), "SALEEM HRC & WS");
  assert.equal(targetManager("SALEEM", "SALEEM-GT/PS"), "SALEEM & ZUHAIR");
  assert.equal(targetManager("GIRISH", null), "GIRISH");
  assert.equal(targetManager(null, null), "Unassigned");
});
