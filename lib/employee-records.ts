import { q } from "@/lib/db";
import type { Employee, StaffRow } from "@/lib/employees";

/** Saves staff-list rows by employee ID. A leave date already on file is kept when a later file shows the person as still employed. */
export async function saveEmployees(list: Employee[]) {
  await q(
    `INSERT INTO app.employees(id, name, department, designation, nationality, joined, left_on)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::date[], $7::date[])
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, designation = EXCLUDED.designation,
       nationality = EXCLUDED.nationality, joined = EXCLUDED.joined, left_on = COALESCE(EXCLUDED.left_on, app.employees.left_on), updated = now()`,
    [list.map((e) => e.id), list.map((e) => e.name), list.map((e) => e.department), list.map((e) => e.designation), list.map((e) => e.nationality), list.map((e) => e.joined), list.map((e) => e.left)],
  );
  return list.length;
}

/** Everyone on file, dates as YYYY-MM-DD text. company and unit are where the person's staff-file department is linked; unlinked people sit under "Unassigned" with their original department text. */
export const listEmployees = () =>
  q<StaffRow>(`SELECT e.id, e.name, e.department, e.designation, e.nationality, e.joined::text AS joined, e.left_on::text AS "left",
      COALESCE(c.name, 'Unassigned') AS company, COALESCE(d.name, e.department) AS unit
    FROM app.employees e
    LEFT JOIN app.department_links l ON l.source_name = e.department
    LEFT JOIN app.company_departments d ON d.id = l.department_id
    LEFT JOIN app.companies c ON c.id = d.company_id`);

export const listDepartments = () =>
  q<{ id: number; companyId: number; name: string }>(
    `SELECT d.id, d.company_id AS "companyId", d.name FROM app.company_departments d JOIN app.companies c ON c.id = d.company_id ORDER BY lower(c.name), lower(d.name)`);

export const addDepartment = (companyId: number, name: string) =>
  q(
    "INSERT INTO app.company_departments(company_id, name) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM app.companies WHERE id = $1) ON CONFLICT DO NOTHING",
    [companyId, name],
  );

export const removeDepartment = (id: number) => q("DELETE FROM app.company_departments WHERE id = $1", [id]);

/** Every department text in the staff lists, with how many people use it and the department it is linked to. Unlinked first. */
export const listSourceNames = () =>
  q<{ name: string; people: number; departmentId: number | null }>(
    `SELECT e.department AS name, count(*)::int AS people, l.department_id AS "departmentId" FROM app.employees e
     LEFT JOIN app.department_links l ON l.source_name = e.department GROUP BY e.department, l.department_id ORDER BY (l.department_id IS NOT NULL), count(*) DESC`);

/** departmentId null removes the link. */
export const linkSourceName = (sourceName: string, departmentId: number | null) =>
  departmentId === null
    ? q("DELETE FROM app.department_links WHERE source_name = $1", [sourceName])
    : q(
        `INSERT INTO app.department_links(source_name, department_id)
         SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM app.company_departments WHERE id = $2)
         ON CONFLICT (source_name) DO UPDATE SET department_id = EXCLUDED.department_id`,
        [sourceName, departmentId],
      );

/** Creates the department under the company from a staff-file name (or reuses one with the same name there) and links the name to it. */
export const addStaffDepartment = (companyId: number, sourceName: string) =>
  q(`WITH d AS (INSERT INTO app.company_departments(company_id, name)
       SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM app.companies WHERE id = $1)
       ON CONFLICT (company_id, lower(name)) DO UPDATE SET name = app.company_departments.name RETURNING id)
     INSERT INTO app.department_links(source_name, department_id) SELECT $2, id FROM d
     ON CONFLICT (source_name) DO UPDATE SET department_id = EXCLUDED.department_id`, [companyId, sourceName]);

/** Does nothing when the company already has another department with that name. */
export const renameDepartment = (id: number, name: string) =>
  q(`UPDATE app.company_departments d SET name = $2 WHERE d.id = $1
     AND NOT EXISTS (SELECT 1 FROM app.company_departments x WHERE x.company_id = d.company_id AND lower(x.name) = lower($2) AND x.id <> d.id)`, [id, name]);
