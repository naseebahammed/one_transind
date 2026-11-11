// Pure helpers for the HR staff lists (new joiners / leavers): reading a sheet and counting movements. No database here, so `node --test` can load it.
import type { Cell } from "./company-data.ts";
import { cleanText } from "./input-validation.ts";

export type Employee = { id: string; name: string; department: string; designation: string; nationality: string; joined: string; left: string | null };

/** An employee as the HR page shows them: company and unit come from the department links. */
export type StaffRow = Employee & { company: string; unit: string };

const HEADERS: Record<string, keyof Employee> = { "emp id": "id", "employee name": "name", "joining date": "joined", "department": "department", "designation": "designation", "nationality_desc": "nationality", "resign_date": "left" };

const text = (c: Cell, maxLength = 200) => cleanText(c, maxLength);
// Excel dates arrive as ISO text (midnight UTC), so the first ten characters are the calendar day.
const day = (c: Cell) => (/^\d{4}-\d{2}-\d{2}/.test(text(c, 40)) ? text(c, 40).slice(0, 10) : null);

/** Reads one staff-list sheet. Rows that are not valid data are errors (the caller refuses the file); a resign date before the joining date is a mistake in the source, so that row is skipped and reported. */
export function parseEmployees(grid: Cell[][]): { employees: Employee[]; errors: string[]; skipped: string[] } {
  const head = grid.findIndex((r) => r.some((c) => text(c).toLowerCase() === "emp id"));
  if (head < 0) return { employees: [], errors: ["No 'Emp ID' header row found."], skipped: [] };
  const col = new Map<keyof Employee, number>();
  grid[head].forEach((c, i) => { const key = HEADERS[text(c).toLowerCase()]; if (key) col.set(key, i); });
  const missing = Object.keys(HEADERS).filter((h) => !col.has(HEADERS[h]));
  if (missing.length) return { employees: [], errors: [`Missing columns: ${missing.join(", ")}.`], skipped: [] };
  const get = (r: Cell[], k: keyof Employee) => r[col.get(k)!] ?? null;
  const employees: Employee[] = [], errors: string[] = [], skipped: string[] = [];
  grid.slice(head + 1).forEach((r, i) => {
    if (r.every((c) => !text(c))) return;
    const row = head + i + 2, id = text(get(r, "id")), joined = day(get(r, "joined")), left = day(get(r, "left"));
    // "(blank)" is how the export marks someone still employed; any other non-date text is a mistake.
    if (!id || !text(get(r, "name"))) errors.push(`Row ${row}: employee ID or name is empty.`);
    else if (!joined) errors.push(`Row ${row}: joining date is not a date.`);
    else if (text(get(r, "left")) && text(get(r, "left")) !== "(blank)" && !left) errors.push(`Row ${row}: resign date is not a date.`);
    else if (left && left < joined) skipped.push(`${id} (row ${row}): resign date is before the joining date`);
    else employees.push({ id: text(get(r, "id"), 40), name: text(get(r, "name"), 120), department: text(get(r, "department"), 80), designation: text(get(r, "designation"), 80), nationality: text(get(r, "nationality"), 60), joined, left });
  });
  return { employees, errors, skipped };
}

/** Joiners and leavers per month (index 0 = January) of one year. */
export function monthlyMovements(employees: Pick<Employee, "joined" | "left">[], year: number) {
  const joiners = Array<number>(12).fill(0), leavers = Array<number>(12).fill(0);
  for (const e of employees) {
    if (e.joined.startsWith(`${year}-`)) joiners[+e.joined.slice(5, 7) - 1]++;
    if (e.left?.startsWith(`${year}-`)) leavers[+e.left.slice(5, 7) - 1]++;
  }
  return { joiners, leavers };
}

/** Joiners and leavers of one year per department, biggest movement first. */
export function departmentMovements(employees: Pick<Employee, "department" | "joined" | "left">[], year: number) {
  const by = new Map<string, { department: string; joiners: number; leavers: number }>();
  for (const e of employees) {
    const row = by.get(e.department) ?? { department: e.department, joiners: 0, leavers: 0 };
    if (e.joined.startsWith(`${year}-`)) row.joiners++;
    if (e.left?.startsWith(`${year}-`)) row.leavers++;
    by.set(e.department, row);
  }
  return [...by.values()].filter((r) => r.joiners || r.leavers).sort((a, b) => b.joiners + b.leavers - (a.joiners + a.leavers));
}

/** One row per employee ID: when a person is in several files, a leave date from any of them is kept. */
export function mergeEmployees(list: Employee[]): Employee[] {
  const by = new Map<string, Employee>();
  for (const e of list) by.set(e.id, { ...e, left: e.left ?? by.get(e.id)?.left ?? null });
  return [...by.values()];
}
