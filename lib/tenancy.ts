// Tenancy roster of the group's residential buildings: reads the monthly occupancy workbook (one sheet per building) and works out
// occupied, empty and upcoming-empty units. Pure helpers + a lazy DB read so `node --test` loads this module directly.
// Occupancy is calculated on demand from the contract dates, never stored.
import type ExcelJS from "exceljs";
import { text } from "./fmcg-masters.ts";
import { cellDate, num, type ImportIssue } from "./report-parsers.ts";

const db = () => import("@/lib/db");

export type TenancyRow = { line: number; unit: string; tenant: string | null; contractStart: string | null; contractEnd: string | null; rent: number | null };
export type TenancyListRow = TenancyRow & { companyId: number; company: string };

const fold = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
/** "BALASEM 1" and "Balasem Gardens 1" are the same building, so the sheet name and the company name are compared by this key. */
export const buildingKey = (name: string) => fold(name).replace(/gardens/g, "").replace(/[^a-z0-9]/g, "");

/** Reads every sheet that has a "Tenant Name" heading. A tenant written as EMPTY is a vacant unit (its dates, if any, are a new contract that has not started). */
export function tenanciesFromWorkbook(wb: ExcelJS.Workbook) {
  const sheets: { sheet: string; rows: TenancyRow[] }[] = [], issues: ImportIssue[] = [];
  for (const ws of wb.worksheets) {
    let head = 0, columns: string[] = [];
    for (let i = 1; i <= 12 && !head; i++) {
      const found: string[] = [];
      ws.getRow(i).eachCell((c, n) => { found[n] = fold(text(c.value)); });
      if (found.some((t) => t === "tenant name")) { head = i; columns = found; }
    }
    if (!head) continue;
    const col = (pattern: RegExp) => columns.findIndex((t) => t !== undefined && pattern.test(t));
    const [unitCol, tenantCol, startCol, endCol, rentCol] = [col(/^(villa no|flat no|description)$/), col(/^tenant name$/), col(/^contract start/), col(/^contract end/), col(/^rent/)];
    if ([unitCol, tenantCol, startCol, endCol, rentCol].includes(-1)) throw new Error(`${ws.name.trim()}: the unit, tenant, contract start, contract end or rent column is missing. The layout has changed.`);
    const rows: TenancyRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i <= head) return;
      // A merged cell (a title across the sheet, or a staff-accommodation name across the date and rent columns) counts only in its first cell.
      const own = (n: number) => { const c = row.getCell(n); return c.isMerged && c.master !== c ? null : c.value; };
      const tenantText = text(own(tenantCol)), where = `${ws.name.trim()}, row ${i}`;
      if (!tenantText) return; // totals and spacer rows have no tenant
      const unit = text(own(unitCol));
      if (!unit) { issues.push({ sheet: ws.name.trim(), row: i, reason: `"${tenantText}" has no unit number.`, loaded: false }); return; }
      const vacant = /^empty\b/i.test(tenantText);
      try {
        const contractStart = cellDate(own(startCol), where), contractEnd = cellDate(own(endCol), where);
        if (!vacant && !contractEnd) issues.push({ sheet: ws.name.trim(), row: i, reason: `Unit ${unit} (${tenantText}) has no contract end date, so it is never counted as ending.`, loaded: true });
        rows.push({ line: rows.length + 1, unit, tenant: vacant ? null : tenantText, contractStart, contractEnd, rent: num(own(rentCol), where) });
      } catch (e) { issues.push({ sheet: ws.name.trim(), row: i, reason: (e as Error).message, loaded: false }); }
    });
    sheets.push({ sheet: ws.name.trim(), rows });
  }
  return { sheets, issues };
}

const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

export type TenancySummary = {
  total: number; occupied: number; vacant: number;
  preLet: TenancyRow[]; vacantUnits: TenancyRow[];
  ending: (TenancyRow & { daysLeft: number })[]; // occupied units whose contract ends from today up to `withinDays` ahead, soonest first
  ended: TenancyRow[]; // contract end date already passed but a tenant is still listed: counted as occupied
};

export function summarizeTenancy(rows: TenancyRow[], today: string, withinDays = 90): TenancySummary {
  const t = dayNumber(today);
  const vacantUnits = rows.filter((r) => !r.tenant), taken = rows.filter((r) => r.tenant);
  const ending = taken
    .filter((r) => r.contractEnd && dayNumber(r.contractEnd) >= t && dayNumber(r.contractEnd) - t <= withinDays)
    .map((r) => ({ ...r, daysLeft: dayNumber(r.contractEnd!) - t }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return {
    total: rows.length, occupied: taken.length, vacant: vacantUnits.length, vacantUnits,
    preLet: vacantUnits.filter((r) => r.contractStart && dayNumber(r.contractStart) > t),
    ending,
    ended: taken.filter((r) => r.contractEnd && dayNumber(r.contractEnd) < t),
  };
}

export async function listTenancies(): Promise<TenancyListRow[]> {
  const { q } = await db();
  return q<TenancyListRow>(
    `SELECT t.company_id AS "companyId", c.name AS company, t.line_no AS line, t.unit, t.tenant,
            to_char(t.contract_start, 'YYYY-MM-DD') AS "contractStart", to_char(t.contract_end, 'YYYY-MM-DD') AS "contractEnd", t.rent::float8 AS rent
     FROM app.tenancies t JOIN app.companies c ON c.id = t.company_id WHERE c.active = 1 AND c.hidden = 0 ORDER BY lower(c.name), t.line_no`,
  );
}
