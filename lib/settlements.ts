// Pure helpers for the HR settlements ledger (one row per payment to an employee): reading the sheet and summarising it. No database here, so `node --test` can load it.
import type { Cell } from "./company-data.ts";
import { day } from "./employees.ts";
import { cleanText } from "./input-validation.ts";

export type Settlement = { uploadDate: string; employeeId: string; name: string; division: string; type: string; account: string | null; amount: number; scheduledDate: string | null; paymentMethod: string | null };

const HEADERS: Record<string, keyof Settlement> = { "upload date": "uploadDate", "emp #": "employeeId", "emp name": "name", "division": "division", "settlement type": "type", "account": "account", "amount": "amount", "scheduled date": "scheduledDate", "card type": "paymentMethod" };

// The sheet spells some divisions several ways; these are the clear duplicates. Anything else is kept as typed.
const DIVISION_ALIASES: Record<string, string> = {
  COCACOLA: "COCA COLA", COCOCOLA: "COCA COLA", "CLOVE TRADING": "CLOVE", "CLOVE COMPANY": "CLOVE", TOPCLEAN: "TOP CLEAN", "TOPN CLEAN": "TOP CLEAN",
  LOGISTIC: "LOGISTICS", "FLEET DEPARTMENT": "FLEET", LEGALDEPARTMENT: "LEGAL", "HR& ADMIN": "HR&ADMIN", DUKAN: "DUKAN FOOD", "GENERAL AD-RES": "GENERAL AD-REST",
};

const clean = (c: Cell, maxLength = 80) => cleanText(c, maxLength).replace(/\s+/g, " ").toUpperCase();
export const cleanDivision = (c: Cell) => { const d = clean(c); return DIVISION_ALIASES[d] ?? (d || "UNSPECIFIED"); };

/** Reads the settlements sheet. A row with a bad date or amount refuses the whole file, so nothing half-loads. */
export function parseSettlements(grid: Cell[][]): { settlements: Settlement[]; errors: string[] } {
  const head = grid.findIndex((r) => r.some((c) => clean(c) === "UPLOAD DATE"));
  if (head < 0) return { settlements: [], errors: ["No 'UPLOAD DATE' header row found."] };
  const col = new Map<keyof Settlement, number>();
  grid[head].forEach((c, i) => { const key = HEADERS[clean(c).toLowerCase()]; if (key) col.set(key, i); });
  const missing = Object.keys(HEADERS).filter((h) => !col.has(HEADERS[h]));
  if (missing.length) return { settlements: [], errors: [`Missing columns: ${missing.join(", ")}.`] };
  const get = (r: Cell[], k: keyof Settlement) => r[col.get(k)!] ?? null;
  const settlements: Settlement[] = [], errors: string[] = [];
  grid.slice(head + 1).forEach((r, i) => {
    if (r.every((c) => !clean(c))) return;
    const row = head + i + 2, uploadDate = day(get(r, "uploadDate")), amount = Number(get(r, "amount"));
    const employeeId = cleanText(get(r, "employeeId"), 40), name = cleanText(get(r, "name"), 120);
    if (!employeeId || !name) errors.push(`Row ${row}: employee number or name is empty.`);
    else if (!uploadDate) errors.push(`Row ${row}: upload date is not a date.`);
    else if (get(r, "amount") === null || !Number.isFinite(amount)) errors.push(`Row ${row}: amount is not a number.`);
    else settlements.push({ uploadDate, employeeId, name, division: cleanDivision(get(r, "division")), type: clean(get(r, "type"), 40) || "UNSPECIFIED", account: cleanText(get(r, "account"), 40) || null, amount: Math.round(amount * 100) / 100, scheduledDate: day(get(r, "scheduledDate")), paymentMethod: clean(get(r, "paymentMethod"), 40) || null });
  });
  return { settlements, errors };
}

type Total = { name: string; payments: number; people: number; total: number };
const group = (rows: Settlement[], key: (s: Settlement) => string): Total[] => {
  const map = new Map<string, { payments: number; people: Set<string>; total: number }>();
  for (const s of rows) {
    const g = map.get(key(s)) ?? { payments: 0, people: new Set<string>(), total: 0 };
    g.payments++; g.people.add(s.employeeId); g.total += s.amount;
    map.set(key(s), g);
  }
  return [...map].map(([name, g]) => ({ name, payments: g.payments, people: g.people.size, total: g.total })).sort((a, b) => b.total - a.total);
};

/** Totals for one calendar year: overall, by division, by settlement type, and per month (index 0 = January). */
export function summarizeSettlements(all: Settlement[], year: number) {
  const rows = all.filter((s) => s.uploadDate.startsWith(`${year}-`));
  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const s of rows) byMonth[Number(s.uploadDate.slice(5, 7)) - 1] += s.amount;
  return { payments: rows.length, people: new Set(rows.map((s) => s.employeeId)).size, total: rows.reduce((x, s) => x + s.amount, 0), byDivision: group(rows, (s) => s.division), byType: group(rows, (s) => s.type), byMonth };
}
