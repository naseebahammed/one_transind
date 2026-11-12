// Sales department monthly targets and sector indicators (pure helpers + lazy DB queries so `node --test` loads this module directly).
import type { SalesIndicatorKey } from "./manual-entry-input.ts";
import { roundMoney, sumMoney } from "./money.ts";

const db = () => import("@/lib/db");

export type SalesDepartmentTargetRow = { code: string; year: number; month: number; period: string; target: number };
export type SalesSectorIndicatorRow = { departmentCode: string; period: string; indicator: SalesIndicatorKey; value: number };

const PERCENT_INDICATORS = new Set<SalesIndicatorKey>(["price_realisation", "promo_uplift"]);

export function computeTargetAttainment(actual: number, target: number | null | undefined): number | null {
  if (target === null || target === undefined || !Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(actual)) return null;
  return roundMoney((actual / target) * 100);
}

export function departmentYtdTargets(rows: SalesDepartmentTargetRow[], year: number, throughMonth: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.year !== year || row.month < 0 || row.month > throughMonth) continue;
    totals.set(row.code, roundMoney((totals.get(row.code) ?? 0) + row.target));
  }
  return totals;
}

export function resolveSectorIndicators(rows: SalesSectorIndicatorRow[], departmentCode: string): Map<SalesIndicatorKey, number> {
  const result = new Map<SalesIndicatorKey, number>();
  if (departmentCode) {
    for (const row of rows) {
      if (row.departmentCode === departmentCode) result.set(row.indicator, row.value);
    }
    return result;
  }

  const groupRows = rows.filter((r) => r.departmentCode === "");
  for (const row of groupRows) result.set(row.indicator, row.value);

  const byIndicator = new Map<SalesIndicatorKey, number[]>();
  for (const row of rows) {
    if (row.departmentCode === "" || result.has(row.indicator)) continue;
    byIndicator.set(row.indicator, [...(byIndicator.get(row.indicator) ?? []), row.value]);
  }
  for (const [indicator, values] of byIndicator) {
    if (!values.length) continue;
    const total = sumMoney(values);
    result.set(indicator, PERCENT_INDICATORS.has(indicator) ? roundMoney(total / values.length) : total);
  }
  return result;
}

const isMissingTable = (e: unknown) => (e as { code?: string })?.code === "42P01";

export async function listSalesDepartmentTargets(year: number): Promise<SalesDepartmentTargetRow[]> {
  const { q } = await db();
  try {
    return await q<SalesDepartmentTargetRow>(
      `SELECT code, EXTRACT(year FROM period)::int AS year, EXTRACT(month FROM period)::int - 1 AS month,
              to_char(period, 'YYYY-MM-DD') AS period, target::float8 AS target
       FROM app.sales_department_targets
       WHERE period >= make_date($1::int, 1, 1) AND period < make_date($1::int + 1, 1, 1)
       ORDER BY code, period`,
      [year],
    );
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

export async function saveSalesDepartmentTarget(code: string, period: string, target: number) {
  const { q } = await db();
  await q(
    `INSERT INTO app.sales_department_targets(code, period, target)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (code, period) DO UPDATE SET target = EXCLUDED.target, updated = now()`,
    [code, period, roundMoney(target)],
  );
}

export async function deleteSalesDepartmentTarget(code: string, period: string) {
  const { q } = await db();
  await q("DELETE FROM app.sales_department_targets WHERE code = $1 AND period = $2::date", [code, period]);
}

export async function listSalesSectorIndicators(period: string): Promise<SalesSectorIndicatorRow[]> {
  const { q } = await db();
  try {
    return await q<SalesSectorIndicatorRow>(
      `SELECT department_code AS "departmentCode", to_char(period, 'YYYY-MM-DD') AS period,
              indicator, value::float8 AS value
       FROM app.sales_sector_indicators
       WHERE period = $1::date
       ORDER BY department_code, indicator`,
      [period],
    );
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

export async function saveSalesSectorIndicators(
  departmentCode: string,
  period: string,
  entries: { indicator: SalesIndicatorKey; value: number }[],
) {
  if (!entries.length) return;
  const { q } = await db();
  await q(
    `INSERT INTO app.sales_sector_indicators(department_code, period, indicator, value)
     SELECT $1, $2::date, ind, val
     FROM unnest($3::text[], $4::numeric[]) AS t(ind, val)
     ON CONFLICT (department_code, period, indicator) DO UPDATE SET value = EXCLUDED.value, updated = now()`,
    [departmentCode, period, entries.map((e) => e.indicator), entries.map((e) => roundMoney(e.value))],
  );
}

export async function deleteSalesSectorIndicator(departmentCode: string, period: string, indicator: string) {
  const { q } = await db();
  await q(
    "DELETE FROM app.sales_sector_indicators WHERE department_code = $1 AND period = $2::date AND indicator = $3",
    [departmentCode, period, indicator],
  );
}

