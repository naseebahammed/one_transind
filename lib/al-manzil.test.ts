import test from "node:test";
import assert from "node:assert/strict";
import { mergeDaily, report, setCell } from "./al-manzil.ts";

const csv = "year,main,sub,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec\n2025,REVENUE,Extra Bed,1,2,3,4,5,6,7,8,9,10,11,12\n2025,STAFF COST,Salary,1,1,1,1,1,1,1,1,1,1,1,1\n";
const rows = [{ year: 2025, main: "REVENUE", sub: "Extra Bed", m: Array(12).fill(10) }];

test("a year without a Room Rent row still reports", () => {
  const r = report(2025, "al-manzil", rows);
  assert.equal(r.revenue[0], 10);
  assert.deepEqual(r.roomRent, Array(12).fill(0));
});

test("setCell replaces one figure and leaves the rest", () => {
  const out = setCell(csv, 2025, "REVENUE", "Extra Bed", 1, 99.456).split("\n");
  assert.equal(out[1], "2025,REVENUE,Extra Bed,1,99.46,3,4,5,6,7,8,9,10,11,12");
  assert.equal(out[2], csv.split("\n")[2]);
});

test("setCell refuses values that would corrupt the file", () => {
  assert.throws(() => setCell(csv, 2025, "REVENUE", "Extra Bed", 0, NaN), /number/);
  assert.throws(() => setCell(csv, 2025, "REVENUE", "Extra Bed", 12, 1), /Month/);
  assert.throws(() => setCell(csv, 2025, "REVENUE", "Extra Bed", -1, 1), /Month/);
});

const H = "date,long_guests,long_rate,long_total,short_guests,short_rate,short_total,rooms_occupied,room_revenue,other_revenue,avg_rate,rooms_available,occ";
const day = (d: string, n = 1) => `${d},${n},1,1,0,0,0,1,1,0,1,1,1`;

test("mergeDaily replaces same days, adds new ones, sorts", () => {
  const out = mergeDaily(`${H}\n${day("2025-01-02")}\n${day("2025-01-03")}\n`, `﻿${H}\r\n${day("2025-01-03", 9)}\r\n${day("2025-01-01")}\r\n`).trim().split("\n");
  assert.deepEqual(out.map((l) => l.slice(0, 12)), [H.slice(0, 12), "2025-01-01,1", "2025-01-02,1", "2025-01-03,9"]);
});

test("mergeDaily rejects a wrong header, bad date, or non-number", () => {
  assert.throws(() => mergeDaily("", "a,b\n1,2"), /first line/);
  assert.throws(() => mergeDaily("", `${H}\n${day("2025-02-31")}`), /Line 2/);
  assert.throws(() => mergeDaily("", `${H}\n${day("2025-01-01").replace(",1,1,1,0", ",x,1,1,0")}`), /Line 2/);
  assert.throws(() => mergeDaily("", H), /no daily rows/);
});
