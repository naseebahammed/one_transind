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

export function trackManagers(
  targets: { manager: string; target: number }[],
  actuals: { manager: string | null; channel: string | null; sales: number }[],
  year: number,
  month: number,
  throughDay: number,
): Omit<ManagerTracking, "throughDate"> {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const workingDays = workingDaysThrough(year, month, lastDay);
  const daysGone = workingDaysThrough(year, month, Math.min(throughDay, lastDay));
  const daysLeft = workingDays - daysGone;

  const byName = new Map<string, { manager: string; target: number; sales: number }>();
  const row = (name: string) => {
    const key = fold(name);
    return byName.get(key) ?? (byName.set(key, { manager: name.trim(), target: 0, sales: 0 }), byName.get(key)!);
  };
  for (const t of targets) row(t.manager).target += t.target;
  for (const a of actuals) row(targetManager(a.manager, a.channel)).sales += a.sales;

  const rows = [...byName.values()].map((r): ManagerTrackingRow => {
    const hasTarget = r.target > 0;
    const balance = roundMoney(r.target - r.sales);
    return {
      manager: r.manager,
      target: r.target,
      sales: roundMoney(r.sales),
      balance,
      achievedPct: hasTarget ? roundMoney((r.sales / r.target) * 100) : null,
      dailyRequired: hasTarget && daysLeft > 0 ? roundMoney(Math.max(balance, 0) / daysLeft) : null,
      projectedPct: hasTarget && daysGone > 0 ? roundMoney(((r.sales / daysGone) * workingDays / r.target) * 100) : null,
    };
  });
  rows.sort((a, b) => b.target - a.target || b.sales - a.sales);
  return { rows, workingDays, daysGone, daysLeft };
}

/** Manager targets for the month against ERP sales up to the latest day the ERP view has. Needs the ERP view (live server only). */
export async function getManagerTracking(periodIso: string): Promise<ManagerTracking> {
  const { q } = await db();
  const [targets, actuals, through] = await Promise.all([
    q<{ manager: string; target: number }>(`SELECT manager, target::float8 AS target FROM app.manager_targets WHERE period = $1::date`, [periodIso]),
    q<{ manager: string | null; channel: string | null; sales: number }>(
      `SELECT s.manager, v.channel, SUM(v.sales_qar)::float8 AS sales
       FROM rpt.sales_vs_target v LEFT JOIN app.salesmen s ON s.code = v.salesman_code WHERE v.period = $1::date GROUP BY 1, 2`,
      [periodIso],
    ),
    q<{ through: string | null }>(`SELECT to_char(max(date), 'YYYY-MM-DD') AS through FROM rpt.sales_lines WHERE date >= $1::date AND date < ($1::date + interval '1 month')`, [periodIso]),
  ]);
  const throughDate = through[0]?.through ?? null;
  const [year, month] = periodIso.split("-").map(Number);
  return { ...trackManagers(targets, actuals, year, month - 1, throughDate ? Number(throughDate.slice(8)) : 0), throughDate };
}
