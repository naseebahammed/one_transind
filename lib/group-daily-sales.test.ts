import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { groupDailyFromWorkbook } from "./group-daily-sales.ts";

const day = (d: number) => new Date(Date.UTC(2026, 10, d));
function book(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("NOV-2026");
  const all = [[], ["", "", "TRANSIND GROUP"], [], ["", "", "SAJID", "", "", "AMR", "TOTAL"], ["", "Date", "Target", "Total Sales", "%", "Total Sales", "Target", "Total Sales"], ...rows];
  all.forEach((r, i) => r.forEach((v, n) => { ws.getCell(1 + i, 1 + n).value = v as ExcelJS.CellValue; }));
  return wb;
}

test("reads target and sales per segment and day, and keeps a real zero apart from a blank", () => {
  const { rows } = groupDailyFromWorkbook(book([
    ["", day(1), 100, 40, 0.4, 5, 100, 45],
    ["", day(2), 100, 0, 0, null, 100, 0],
    ["", day(3), 100, 60, 0.6, 7, 100, 67],
    ["", day(4), 100, 0, 0, 0, 100, 0], // unfilled rest of the month
    ["", "Daily Avg.", 100, 33], // the average row closes the month
    ["", day(5), 100, 99, 0.9, 9, 100, 108], // whatever repeats below it is not read
  ]));
  assert.deepEqual(rows.filter((r) => r.date === "2026-11-01"), [
    { date: "2026-11-01", segment: "SAJID", target: 100, sales: 40 },
    { date: "2026-11-01", segment: "AMR", target: null, sales: 5 },
    { date: "2026-11-01", segment: "TOTAL", target: 100, sales: 45 },
  ]);
  assert.equal(rows.find((r) => r.date === "2026-11-02" && r.segment === "SAJID")?.sales, 0); // verified zero
  assert.equal(rows.find((r) => r.date === "2026-11-02" && r.segment === "AMR"), undefined); // blank = not submitted
  assert.equal(rows.some((r) => r.date === "2026-11-04"), false);
  assert.equal(rows.length, 3 + 2 + 3);
});

test("a bad number is reported and not loaded as 0", () => {
  const { rows, issues } = groupDailyFromWorkbook(book([["", day(1), 100, "n/a", 0, 5, 100, 45]]));
  assert.equal(issues.length, 1);
  assert.equal(rows.some((r) => r.segment === "SAJID"), false);
});
