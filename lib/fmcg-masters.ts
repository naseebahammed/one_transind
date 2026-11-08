// Reads the FMCG reference sheets into rows: salesmen and customers (Market Audit), items and brands (Stock Report), monthly targets (Daily Sales Report).
// Pure (no database) so `node --test` can load it. A workbook supplies whichever of these sheets it has.
import type ExcelJS from "exceljs";

import { MONTHS } from "./format.ts";
import { num, type ImportIssue } from "./report-parsers.ts";

export type Salesman = { code: string; name: string; status: string; teamLead: string | null; manager: string | null; salesCategory: string | null; route: string | null };
export type Customer = { code: string; name: string; groupName: string | null; creditDays: number | null; accountant: string | null; status: string; balance: number | null };
export type Item = { code: string; name: string; brand: string; packing: string | null; size: string | null; itemType: string | null; department: string | null; manager: string | null };
export type Brand = { code: string; name: string; department: string | null; manager: string | null; category: string | null };
export type Assignment = { salesmanCode: string; salesmanName: string; brand: string; supervisor: string | null; channel: string | null; department: string | null; target: number | null };
export type ManagerTarget = { manager: string; target: number };

const round = (v: number) => Math.round(v * 100) / 100;
const fold = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

/** Text of a cell. "(blank)" is how a pivot table prints an empty value. */
export function text(v: ExcelJS.CellValue) {
  const x: unknown = typeof v === "object" && v && "result" in v ? v.result : v;
  const t = typeof x === "object" && x ? ("richText" in x ? (x as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("") : "") : String(x ?? "");
  const clean = t.replace(/\s+/g, " ").trim();
  return clean === "(blank)" ? "" : clean;
}
const orNull = (v: string) => v || null;

export type Table = { ws: ExcelJS.Worksheet; head: number; sheet: string; column: (heading: string) => number };

/** Finds a sheet and its heading row by name, because these are pivot exports whose headings sit a few rows down. Null when the workbook has no such sheet. */
export function findTable(wb: ExcelJS.Workbook, sheetName: string, firstHeading: string, required: string[]): Table | null {
  const ws = wb.worksheets.find((w) => fold(w.name) === fold(sheetName));
  if (!ws) return null;
  for (let head = 1; head <= 12; head++) {
    const columns = new Map<string, number>();
    ws.getRow(head).eachCell((c, n) => { const t = fold(text(c.value)); if (t && !columns.has(t)) columns.set(t, n); });
    if (!columns.has(fold(firstHeading))) continue;
    const missing = required.filter((h) => !columns.has(fold(h)));
    if (missing.length) throw new Error(`${sheetName}: no "${missing[0]}" column. The layout has changed.`);
    return { ws, head, sheet: ws.name.trim(), column: (h) => columns.get(fold(h))! };
  }
  throw new Error(`${sheetName}: no "${firstHeading}" heading in the first rows. The layout has changed.`);
}

export function eachRow(t: Table, visit: (cell: (heading: string) => string, row: ExcelJS.Row, i: number) => void) {
  t.ws.eachRow({ includeEmpty: false }, (row, i) => { if (i > t.head) visit((h) => text(row.getCell(t.column(h)).value), row, i); });
}

export const ERP_CODE = /^[A-Z0-9]+$/i; // the ERP has letter-prefixed codes as well (V364, CS00022, E0E0000)
const salesmanCode = (v: string) => (/^\d+$/.test(v) ? v.padStart(3, "0") : v); // the sheets mix 28 and 028 for the same salesman
const brandCode = (v: string) => v.toUpperCase();
const activeOrNot = (v: string) => (fold(v).replace(/ /g, "") === "active" ? "Active" : "Inactive");

/** Whatever FMCG reference sheets the workbook holds. Unknown codes and bad numbers are reported, never guessed. */
export function mastersFromWorkbook(wb: ExcelJS.Workbook) {
  const issues: ImportIssue[] = [], salesmen: Salesman[] = [], customers: Customer[] = [], items: Item[] = [], assignments: Assignment[] = [], managerTargets: ManagerTarget[] = [];
  const brands = new Map<string, Brand>();
  const seenBrand = (name: string) => { const code = brandCode(name); if (code && !brands.has(code)) brands.set(code, { code, name, department: null, manager: null, category: null }); return code; };
  const skip = (t: Table, i: number, reason: string) => issues.push({ sheet: t.sheet, row: i, reason, loaded: false });

  const salesmanTable = findTable(wb, "SALESMAN MASTER", "Salesman Code", ["Salesman Name", "STATUS.", "TEAM_LEAD", "MANAGER_NAME", "SALES_CATEGORY", "ROUTE"]);
  if (salesmanTable) eachRow(salesmanTable, (cell, _, i) => {
    const code = cell("Salesman Code");
    if (!code || fold(code) === "grand total") return;
    if (!ERP_CODE.test(code) || !cell("Salesman Name")) return skip(salesmanTable, i, `"${code}" is not a salesman code with a name.`);
    salesmen.push({ code: salesmanCode(code), name: cell("Salesman Name"), status: activeOrNot(cell("STATUS.")), teamLead: orNull(cell("TEAM_LEAD")), manager: orNull(cell("MANAGER_NAME")), salesCategory: orNull(cell("SALES_CATEGORY")), route: orNull(cell("ROUTE")) });
  });

  const customerTable = findTable(wb, "CUSTOMER MASTER", "SLMA_ACNO", ["COAD_PTY_FULL_NAME", "CREDIT_DAYS", "ACCOUNTANT", "COAD_GROUP_DESC", "SLMA_STATUS", "Sum of BALANCE"]);
  if (customerTable) eachRow(customerTable, (cell, row, i) => {
    const code = cell("SLMA_ACNO");
    if (!code || fold(code) === "grand total") return;
    if (!ERP_CODE.test(code) || !cell("COAD_PTY_FULL_NAME")) return skip(customerTable, i, `"${code}" is not a customer code with a name.`);
    const credit = cell("CREDIT_DAYS");
    let balance: number | null;
    try { balance = num(row.getCell(customerTable.column("Sum of BALANCE")).value, `CUSTOMER MASTER, row ${i}`); } catch (e) { return skip(customerTable, i, (e as Error).message); }
    customers.push({ code, name: cell("COAD_PTY_FULL_NAME"), groupName: orNull(cell("COAD_GROUP_DESC")), creditDays: /^\d+$/.test(credit) ? Number(credit) : null, accountant: orNull(cell("ACCOUNTANT")), status: activeOrNot(cell("SLMA_STATUS")), balance });
  });

  const brandTable = findTable(wb, "MANAGERS WITH BRAND", "BRAND NAME", ["DEPT.", "MANAGER NAME", "CATEGORY"]);
  if (brandTable) eachRow(brandTable, (cell, _, i) => {
    const name = cell("BRAND NAME");
    if (!name) return;
    const code = brandCode(name), earlier = brands.get(code), manager = orNull(cell("MANAGER NAME"));
    if (earlier?.manager && manager && fold(earlier.manager) !== fold(manager)) issues.push({ sheet: brandTable.sheet, row: i, reason: `${name} is listed under both ${earlier.manager} and ${manager}; the later one was kept.`, loaded: true });
    brands.set(code, { code, name, department: orNull(cell("DEPT.")), manager, category: orNull(cell("CATEGORY")) });
  });

  const itemTable = findTable(wb, "PRODUCT & STOCK LIST", "ITEM_CODE", ["BRAND", "ITEM DESCRIPTION", "PACKING", "SIZE", "TYPE", "MANAGER", "DEPT."]);
  if (itemTable) eachRow(itemTable, (cell, _, i) => {
    const code = cell("ITEM_CODE");
    if (!code) return;
    if (!/^\d+$/.test(code) || !cell("ITEM DESCRIPTION") || !cell("BRAND")) return skip(itemTable, i, `"${code}" is not an item code with a name and brand.`);
    items.push({ code, name: cell("ITEM DESCRIPTION"), brand: seenBrand(cell("BRAND")), packing: orNull(cell("PACKING")), size: orNull(cell("SIZE")), itemType: orNull(cell("TYPE").replace(/ /g, "")), department: orNull(cell("DEPT.")), manager: orNull(cell("MANAGER")) });
  });

  // Targets: one row per salesman and brand for the month, plus the manager totals, which are higher because some teams have no per-salesman target.
  let period: string | null = null, controlTotal: number | null = null;
  const targetTable = findTable(wb, "SALESMAN WISE DSR", "SM CODE", ["SMAN_NAME", "SUPERVISOR NAME", "BRAND", "CHANNEL", "DEPT"]);
  const managerTable = findTable(wb, "MANAGER WISE", "MANAGER", ["TARGET"]);
  if (targetTable && managerTable) {
    let named = "";
    managerTable.ws.eachRow({ includeEmpty: false }, (row, i) => { if (i < managerTable.head) row.eachCell((c) => { named ||= text(c.value).match(/20\d{2}\s*-\s*[A-Za-z]{3}/)?.[0] ?? ""; }); });
    const month = named ? MONTHS.findIndex((m) => m.toLowerCase() === named.slice(-3).toLowerCase()) : -1;
    if (month < 0) throw new Error("MANAGER WISE: no heading like 2026-NOVEMBER, so the month is unknown.");
    period = `${named.slice(0, 4)}-${String(month + 1).padStart(2, "0")}-01`;
    let targetColumn = 0, targetHeading = "";
    targetTable.ws.getRow(targetTable.head).eachCell((c, n) => { const t = fold(text(c.value)); if (/^[a-z]{3} target$/.test(t)) { targetColumn = n; targetHeading = t; } });
    if (!targetColumn) throw new Error("SALESMAN WISE DSR: no column like NOV TARGET.");
    if (targetHeading.slice(0, 3) !== MONTHS[month].toLowerCase()) throw new Error(`SALESMAN WISE DSR: the column says ${targetHeading.slice(0, 3)} but the MANAGER WISE heading says ${MONTHS[month]}.`);

    let printedTotal: number | null = null;
    eachRow(targetTable, (cell, row, i) => {
      const code = cell("SM CODE");
      let target: number | null;
      try { target = num(row.getCell(targetColumn).value, `SALESMAN WISE DSR, row ${i}`); } catch (e) { return skip(targetTable, i, (e as Error).message); }
      if (!code) { if (target !== null) printedTotal = target; return; } // the only row with a target and no salesman is the sheet's total
      if (!ERP_CODE.test(code) || !cell("BRAND")) return skip(targetTable, i, `"${code}" is not a salesman code with a brand.`);
      assignments.push({ salesmanCode: salesmanCode(code), salesmanName: cell("SMAN_NAME"), brand: seenBrand(cell("BRAND")), supervisor: orNull(cell("SUPERVISOR NAME").replace(/\s*&\s*/g, " & ")), channel: orNull(cell("CHANNEL")), department: orNull(cell("DEPT")), target });
    });
    const sum = round(assignments.reduce((s, a) => s + (a.target ?? 0), 0));
    controlTotal = printedTotal;
    if (printedTotal !== null && Math.abs(sum - printedTotal) > 1) issues.push( // each target is rounded to the cent, so the sum can drift by a few cents
{ sheet: targetTable.sheet, row: targetTable.head, reason: `The salesman targets add up to ${sum} but the sheet's total says ${printedTotal}.`, loaded: true });

    let managerTotal: number | null = null;
    eachRow(managerTable, (cell, row, i) => {
      const manager = cell("MANAGER");
      if (!manager) return;
      let target: number | null;
      try { target = num(row.getCell(managerTable.column("TARGET")).value, `MANAGER WISE, row ${i}`); } catch (e) { return skip(managerTable, i, (e as Error).message); }
      if (target === null) return;
      if (fold(manager) === "total") managerTotal = target; else managerTargets.push({ manager, target });
    });
    const managerSum = round(managerTargets.reduce((s, x) => s + x.target, 0));
    if (managerTotal !== null && Math.abs(managerSum - managerTotal) > 0.05) issues.push({ sheet: managerTable.sheet, row: managerTable.head, reason: `The manager targets add up to ${managerSum} but the sheet's total says ${managerTotal}.`, loaded: true });
  }

  const rowsRead = salesmen.length + customers.length + items.length + assignments.length + managerTargets.length;
  return { salesmen, customers, items, brands: [...brands.values()], assignments, managerTargets, period, controlTotal, issues, rowsRead };
}

export type Masters = ReturnType<typeof mastersFromWorkbook>;
