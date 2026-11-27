import { q } from "@/lib/db";
import type { BrandMonthPlan, BrandYearPlan } from "@/lib/brand-budget";

/** Replaces the whole year's brand plan, so brands dropped from the new file do not linger. */
export async function saveBrandYearPlan(year: number, rows: BrandYearPlan[]) {
  if (!rows.length) return 0;
  await q(
    `WITH gone AS (DELETE FROM app.brand_plan_years WHERE year = $1)
     INSERT INTO app.brand_plan_years(year, brand, prior_actual, forecast, target, cogs, rebate, secondary, supplier)
     SELECT $1, * FROM unnest($2::text[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[])`,
    [year, rows.map((r) => r.brand), rows.map((r) => r.priorActual), rows.map((r) => r.forecast), rows.map((r) => r.target), rows.map((r) => r.cogs), rows.map((r) => r.rebate), rows.map((r) => r.secondary), rows.map((r) => r.supplier)],
  );
  return rows.length;
}

/** Replaces the whole year's monthly plan. */
export async function saveBrandMonthPlan(year: number, rows: BrandMonthPlan[]) {
  if (!rows.length) return 0;
  await q(
    `WITH gone AS (DELETE FROM app.brand_plan_months WHERE year = $1)
     INSERT INTO app.brand_plan_months(year, manager, brand, product_group, month, amount)
     SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::int[], $6::numeric[])`,
    [year, rows.map((r) => r.manager), rows.map((r) => r.brand), rows.map((r) => r.productGroup), rows.map((r) => r.month), rows.map((r) => r.amount)],
  );
  return rows.length;
}

export type BrandYearPlanRow = BrandYearPlan & { year: number };

export const listBrandYearPlans = () =>
  q<BrandYearPlanRow>(`SELECT year, brand, prior_actual::float8 AS "priorActual", forecast::float8 AS forecast, target::float8 AS target, cogs::float8 AS cogs, rebate::float8 AS rebate, secondary::float8 AS secondary, supplier::float8 AS supplier
     FROM app.brand_plan_years ORDER BY year, target DESC`);

/** The monthly plan added up per brand and month, for one year. */
export const listBrandMonthTotals = (year: number) =>
  q<{ brand: string; month: number; amount: number }>(`SELECT brand, month, SUM(amount)::float8 AS amount FROM app.brand_plan_months WHERE year = $1 GROUP BY brand, month ORDER BY brand, month`, [year]);
