// Reads the "Transind Group Daily Sales Report" workbook: one sheet per month, one row per day, and per segment (Sajid, Raymond, Saleem, Restaurant, Dukan, ...) a target and a sales column.
// Pure (no database) so `node --test` can load it. Amounts in QAR.
// "TRADING & DIST" is the sum of the four sales teams before it and "TOTAL" is the sum of the whole sheet, so add up the leaf segments only, never all of them.
import type ExcelJS from "exceljs";

import { roundMoney } from "./money.ts";
import { text } from "./fmcg-masters.ts";
import { cellDate, num, type ImportIssue } from "./report-parsers.ts";

export type GroupDailyRow = { date: string; segment: string; target: number | null; sales: number | null }; // null = the sheet left it blank (not submitted); 0 = a real zero

const fold = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

/** Rows from every sheet that has a "Date" heading with the segment names in the row above it. Other sheets are ignored.
 *  Days after the last day with sales in the newest sheet are the unfilled rest of the month, so they are skipped. */
export function groupDailyFromWorkbook(wb: ExcelJS.Workbook, fromYear = 0) {
  type Day = { date: string; row: number; cells: GroupDailyRow[] };
  const issues: ImportIssue[] = [], sheets: { name: string; days: Day[] }[] = [];
  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim();
    let head = 0, dateColumn = 0;
    for (let i = 2; i <= 10 && !head; i++) ws.getRow(i).eachCell((c, n) => { if (!head && fold(text(c.value)) === "date") { head = i; dateColumn = n; } });
    if (!head) continue;
    const segments: { name: string; column: number }[] = [];
    ws.getRow(head - 1).eachCell((c, n) => { const name = c.master === c ? text(c.value) : ""; if (name) segments.push({ name, column: n }); }); // a merged name is repeated in every cell it covers: read it once
    const lastColumn = ws.getRow(head).cellCount;
    const groups = segments.map((s, i) => {
      const end = (segments[i + 1]?.column ?? lastColumn + 1) - 1;
      let target = 0, sales = 0;
      for (let n = s.column; n <= end; n++) { const t = fold(text(ws.getRow(head).getCell(n).value)); if (t.startsWith("target")) target ||= n; else if (t.includes("sales")) sales ||= n; }
      return { name: s.name, target, sales };
    }).filter((g) => g.target || g.sales);
    if (!groups.length || !cellDate(ws.getRow(head + 1).getCell(dateColumn).value, sheet)) continue; // an older sheet puts a second heading row (Confirmed / DO Pending / RV) under "Date": not this layout
    const days: Day[] = [];
    let ended = false; // the "Daily Avg." row closes the month; older sheets repeat the layout below it
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= head || ended) return;
      const date = cellDate(row.getCell(dateColumn).value, `${sheet}, row ${i}`);
      if (!date) { ended = days.length > 0; return; }
      if (date < "2000" || +date.slice(0, 4) < fromYear) return; // dates typed without a year, or before the first year wanted
      const cells: GroupDailyRow[] = [];
      for (const g of groups) {
        try {
          const target = g.target ? num(row.getCell(g.target).value, `${sheet}, row ${i}, ${g.name} target`) : null, sales = g.sales ? num(row.getCell(g.sales).value, `${sheet}, row ${i}, ${g.name} sales`) : null;
          if (target !== null || sales !== null) cells.push({ date, segment: g.name, target, sales });
        } catch (e) {
          issues.push({ sheet, row: i, reason: (e as Error).message, loaded: false });
        }
      }
      days.push({ date, row: i, cells });
    });
    if (days.length) sheets.push({ name: sheet, days });
  }
  const latest = sheets.flatMap((s) => s.days.map((d) => d.date)).sort().at(-1)?.slice(0, 7);
  const rows: GroupDailyRow[] = [], seen = new Map<string, string>();
  for (const s of sheets) {
    const hasSales = (d: Day) => d.cells.some((c) => c.sales);
    const last = s.days[0].date.slice(0, 7) === latest ? s.days.findLastIndex(hasSales) : s.days.length - 1; // only the newest month has unfilled days at its end
    for (const d of s.days.slice(0, last + 1)) for (const c of d.cells) {
      const key = `${c.date}|${c.segment}`, other = seen.get(key);
      if (other) throw new Error(`${s.name} and ${other} both have ${c.segment} on ${c.date}. Correct the dates in one of the two sheets.`);
      seen.set(key, s.name);
      rows.push({ ...c, target: c.target === null ? null : roundMoney(c.target), sales: c.sales === null ? null : roundMoney(c.sales) });
    }
  }
  return { rows, issues, rowsRead: rows.length };
}
