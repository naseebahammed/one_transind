// Manager target tracking: sales so far, balance, and the daily balance required to still hit the monthly target.
// Pure helpers + a lazy DB query so `node --test` loads this module directly. Fridays are non-working days (matches the manager tracker workbook: Nov 2026 = 26 days).
import { roundMoney } from "./money.ts";

const db = () => import("@/lib/db");

export type ManagerTrackingRow = {
  manager: string;
  target: number;
  sales: number;
  balance: number;
  achievedPct: number | null;
  dailyRequired: number | null;
  projectedPct: number | null;
};
export type ManagerTracking = { rows: ManagerTrackingRow[]; workingDays: number; daysGone: number; daysLeft: number; throughDate: string | null };

const fold = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
// Salesmen carry one manager name but targets are set per team (Saleem has two). shortcut: names hardcoded, move to a table if teams change.
export function targetManager(manager: string | null, channel: string | null): string {
  const name = fold(manager ?? "");
  if (name === "sajid") return "SAJID & MINHAJ";
  if (name === "raymond" || name === "ray") return "RAYMOND";
  if (name === "saleem") return /(^|[^a-z])(hrc|ws)([^a-z]|$)/i.test(channel ?? "") ? "SALEEM HRC & WS" : "SALEEM & ZUHAIR";
  return manager?.trim() || "Unassigned";
}

const isWorking = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).getUTCDay() !== 5;

/** Working days in the month (month is 0-based) up to and including `throughDay`. */
export function workingDaysThrough(year: number, month: number, throughDay: number): number {
  let n = 0;
  for (let d = 1; d <= throughDay; d++) if (isWorking(year, month, d)) n++;
  return n;
}

type Pace = Omit<ManagerTrackingRow, "manager">;
type Days = { workingDays: number; daysGone: number; daysLeft: number };

function monthDays(year: number, month: number, throughDay: number): Days {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const workingDays = workingDaysThrough(year, month, lastDay);
  const daysGone = workingDaysThrough(year, month, Math.min(throughDay, lastDay));
  return { workingDays, daysGone, daysLeft: workingDays - daysGone };
}

function paceOf(target: number, sales: number, { workingDays, daysGone, daysLeft }: Days): Pace {
  const hasTarget = target > 0;
  const balance = roundMoney(target - sales);
  return {
    target,
    sales: roundMoney(sales),
    balance,
    achievedPct: hasTarget ? roundMoney((sales / target) * 100) : null,
    dailyRequired: hasTarget && daysLeft > 0 ? roundMoney(Math.max(balance, 0) / daysLeft) : null,
    projectedPct: hasTarget && daysGone > 0 ? roundMoney(((sales / daysGone) * workingDays / target) * 100) : null,
  };
}

export function trackManagers(
  targets: { manager: string; target: number }[],
  actuals: { manager: string | null; channel: string | null; sales: number }[],
  year: number,
  month: number,
  throughDay: number,
): Omit<ManagerTracking, "throughDate"> {
  const days = monthDays(year, month, throughDay);

  const byName = new Map<string, { manager: string; target: number; sales: number }>();
  const row = (name: string) => {
    const key = fold(name);
    return byName.get(key) ?? (byName.set(key, { manager: name.trim(), target: 0, sales: 0 }), byName.get(key)!);
  };
  for (const t of targets) row(t.manager).target += t.target;
  for (const a of actuals) row(targetManager(a.manager, a.channel)).sales += a.sales;

  const rows = [...byName.values()].map((r): ManagerTrackingRow => ({ manager: r.manager, ...paceOf(r.target, r.sales, days) }));
  rows.sort((a, b) => b.target - a.target || b.sales - a.sales);
  return { rows, ...days };
}

export type SalesmanTrackingRow = Pace & { code: string; salesman: string; channel: string; department: string };
export type SupervisorTracking = { supervisor: string; total: Pace; salesmen: SalesmanTrackingRow[] };
export type SalesmanInput = { code: string; salesman: string; supervisor: string | null; channel: string | null; department: string | null; target: number; sales: number };

/** Salesmen grouped under their supervisor, each with the same target pace figures as the manager table. */
export function trackSalesmen(inputs: SalesmanInput[], year: number, month: number, throughDay: number): { supervisors: SupervisorTracking[] } & Days {
  const days = monthDays(year, month, throughDay);
  const merged = new Map<string, SalesmanInput>();
  for (const i of inputs) {
    const supervisor = i.supervisor?.trim() || "Unassigned";
    const key = [i.code, supervisor, i.channel ?? "", i.department ?? ""].join("|");
    const have = merged.get(key);
    if (have) { have.target += i.target; have.sales += i.sales; } else merged.set(key, { ...i, supervisor });
  }
  const groups = new Map<string, SalesmanInput[]>();
  for (const i of merged.values()) groups.set(i.supervisor!, [...(groups.get(i.supervisor!) ?? []), i]);

  const supervisors = [...groups].map(([supervisor, list]): SupervisorTracking => ({
    supervisor,
    total: paceOf(list.reduce((n, i) => n + i.target, 0), list.reduce((n, i) => n + i.sales, 0), days),
    salesmen: list
      .map((i): SalesmanTrackingRow => ({ code: i.code, salesman: i.salesman, channel: i.channel ?? "", department: i.department ?? "", ...paceOf(i.target, i.sales, days) }))
      .sort((a, b) => b.target - a.target || b.sales - a.sales),
  }));
  supervisors.sort((a, b) => b.total.target - a.total.target || b.total.sales - a.total.sales);
  return { supervisors, ...days };
}

/** Manager targets for the month against ERP sales up to the latest day the ERP view has. Reads app.sales_clean, which exists only where the ERP data has been loaded. */
export async function getManagerTracking(periodIso: string): Promise<ManagerTracking> {
  const { q } = await db();
  const [targets, actuals, through] = await Promise.all([
    q<{ manager: string; target: number }>(`SELECT manager, target::float8 AS target FROM app.manager_targets WHERE period = $1::date`, [periodIso]),
    // app.sales_clean is the app's cached copy of the ERP sales (the raw ERP view takes over a minute). It has the salesman's name, not code, so one salesman row is picked per name (an active one first).
    q<{ manager: string | null; channel: string | null; sales: number }>(
      `SELECT sm.manager, a.channel, SUM(l."NET_AMOUNT")::float8 AS sales
       FROM app.sales_clean l
       LEFT JOIN (SELECT DISTINCT ON (upper(trim(name))) upper(trim(name)) AS name_key, code, manager FROM app.salesmen ORDER BY upper(trim(name)), (upper(status) = 'ACTIVE') DESC, code) sm ON sm.name_key = upper(trim(l."SMAN_NAME"))
       LEFT JOIN app.sales_assignments a ON a.period = $1::date AND a.salesman_code = sm.code AND a.brand = upper(trim(l."BRAND"))
       WHERE l."DOC_DATE" >= $1::date AND l."DOC_DATE" < ($1::date + interval '1 month') GROUP BY 1, 2`,
      [periodIso],
    ),
    q<{ through: string | null }>(`SELECT to_char(max("DOC_DATE"), 'YYYY-MM-DD') AS through FROM app.sales_clean WHERE "DOC_DATE" >= $1::date AND "DOC_DATE" < ($1::date + interval '1 month')`, [periodIso]),
  ]);
  const throughDate = through[0]?.through ?? null;
  const [year, month] = periodIso.split("-").map(Number);
  return { ...trackManagers(targets, actuals, year, month - 1, throughDate ? Number(throughDate.slice(8)) : 0), throughDate };
}

/** Salesman targets against ERP sales for the month, same data source and day cut-off as getManagerTracking. */
export async function getSalesmanTracking(periodIso: string): Promise<{ supervisors: SupervisorTracking[] } & Days> {
  const { q } = await db();
  const [targets, actuals, through] = await Promise.all([
    q<Omit<SalesmanInput, "sales">>(
      `SELECT a.salesman_code AS code, COALESCE(s.name, a.salesman_code) AS salesman, a.supervisor, a.channel, a.department, SUM(a.target)::float8 AS target
       FROM app.sales_assignments a LEFT JOIN app.salesmen s ON s.code = a.salesman_code WHERE a.period = $1::date GROUP BY 1, 2, 3, 4, 5`,
      [periodIso],
    ),
    q<Omit<SalesmanInput, "target">>(
      `SELECT sm.code, max(l."SMAN_NAME") AS salesman, a.supervisor, a.channel, a.department, SUM(l."NET_AMOUNT")::float8 AS sales
       FROM app.sales_clean l
       JOIN (SELECT DISTINCT ON (upper(trim(name))) upper(trim(name)) AS name_key, code FROM app.salesmen ORDER BY upper(trim(name)), (upper(status) = 'ACTIVE') DESC, code) sm ON sm.name_key = upper(trim(l."SMAN_NAME"))
       LEFT JOIN app.sales_assignments a ON a.period = $1::date AND a.salesman_code = sm.code AND a.brand = upper(trim(l."BRAND"))
       WHERE l."DOC_DATE" >= $1::date AND l."DOC_DATE" < ($1::date + interval '1 month') GROUP BY 1, 3, 4, 5`,
      [periodIso],
    ),
    q<{ through: string | null }>(`SELECT to_char(max("DOC_DATE"), 'YYYY-MM-DD') AS through FROM app.sales_clean WHERE "DOC_DATE" >= $1::date AND "DOC_DATE" < ($1::date + interval '1 month')`, [periodIso]),
  ]);
  const [year, month] = periodIso.split("-").map(Number);
  const throughDay = through[0]?.through ? Number(through[0].through.slice(8)) : 0;
  return trackSalesmen([...targets.map((t) => ({ ...t, sales: 0 })), ...actuals.map((a) => ({ ...a, target: 0 }))], year, month - 1, throughDay);
}
