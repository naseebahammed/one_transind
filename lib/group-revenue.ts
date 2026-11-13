// Group-wide monthly revenue and budget target aggregation across ERP Trading and non-ERP subsidiaries.
import { roundMoney, sumMoney } from "./money.ts";
import { SECTOR } from "./org.ts";

export type SubsidiaryRevenueRow = {
  companyId: number;
  year: number;
  month: number;
  amount: number;
};

export function buildCompanyMonthlySeries(
  rows: SubsidiaryRevenueRow[],
  companyId: number,
  year: number,
): number[] {
  const months = Array<number>(12).fill(0);
  for (const row of rows) {
    if (row.companyId === companyId && row.year === year && row.month >= 0 && row.month < 12) {
      months[row.month] = roundMoney(months[row.month] + row.amount);
    }
  }
  return months;
}

export function computeGroupMonthlyRevenue(params: {
  erpMonths: { month: number; value: number }[];
  throughMonth: number;
  nonTradingCompanyIds: number[];
  subsidiaryRows: SubsidiaryRevenueRow[];
  year: number;
}): number[] {
  const { erpMonths, throughMonth, nonTradingCompanyIds, subsidiaryRows, year } = params;
  const companySeries = nonTradingCompanyIds.map((id) =>
    buildCompanyMonthlySeries(subsidiaryRows, id, year),
  );
  return Array.from({ length: throughMonth + 1 }, (_, monthIdx) => {
    const erpValue = erpMonths.find((m) => m.month === monthIdx + 1)?.value ?? 0;
    const subValues = companySeries.map((s) => s[monthIdx] ?? 0);
    return sumMoney([erpValue, ...subValues]);
  });
}

export function computeGroupMonthlyTargetsMillions(params: {
  throughMonth: number;
  year: number;
  erpTargets: { year: number; month: number; target: number }[];
  subsidiaryBudgetMonths: number[];
}): number[] {
  const { throughMonth, year, erpTargets, subsidiaryBudgetMonths } = params;
  const erpByMonth = Array<number>(12).fill(0);
  for (const row of erpTargets) {
    if (row.year === year && row.month >= 0 && row.month < 12) {
      erpByMonth[row.month] = roundMoney(erpByMonth[row.month] + row.target);
    }
  }
  const combined = Array.from({ length: throughMonth + 1 }, (_, i) =>
    sumMoney([erpByMonth[i] ?? 0, subsidiaryBudgetMonths[i] ?? 0]),
  );
  if (!combined.some((v) => v > 0)) return [];
  return combined.map((v) => v / 1e6);
}

const loadDb = () => import("@/lib/db");
const salesCache = () => import("@/lib/sales-cache");

export async function querySubsidiaryMonthlyRevenue(yearsList: number[]): Promise<SubsidiaryRevenueRow[]> {
  if (!yearsList.length) return [];
  const { q } = await loadDb();
  const minYear = Math.min(...yearsList);
  const maxYear = Math.max(...yearsList);
  return q<SubsidiaryRevenueRow>(
    `SELECT
       company_id AS "companyId",
       EXTRACT(year FROM period)::int AS year,
       EXTRACT(month FROM period)::int - 1 AS month,
       COALESCE(SUM(amount_qar), 0)::float8 AS amount
     FROM rpt.company_monthly_revenue
     WHERE period >= make_date($2::int, 1, 1)
       AND period < make_date($3::int + 1, 1, 1)
       AND EXTRACT(year FROM period)::int = ANY($1::int[])
     GROUP BY company_id, EXTRACT(year FROM period)::int, EXTRACT(month FROM period)::int`,
    [yearsList, minYear, maxYear],
  );
}

export async function listSubsidiaryMonthlyRevenue(yearsList: number[]): Promise<SubsidiaryRevenueRow[]> {
  if (!yearsList.length) return [];
  return (await salesCache()).loadCachedSubsidiaryMonthlyRevenue(yearsList);
}

export async function querySubsidiaryMonthlyBudgetRevenue(year: number): Promise<number[]> {
  const { q } = await loadDb();
  const rows = await q<{ month: number; amount: number }>(
    `SELECT
       EXTRACT(month FROM f.period)::int - 1 AS month,
       COALESCE(SUM(f.value), 0)::float8 AS amount
     FROM app.company_figures f
     JOIN app.companies c ON c.id = f.company_id
     WHERE f.section = 'budget'
       AND f.line = 'Revenue'
       AND c.active = 1
       AND c.hidden = 0
       AND c.sector <> $2
       AND f.period >= make_date($1::int, 1, 1)
       AND f.period < make_date($1::int + 1, 1, 1)
     GROUP BY 1`,
    [year, SECTOR.trading],
  );
  const months = Array<number>(12).fill(0);
  for (const row of rows) {
    if (row.month >= 0 && row.month < 12) months[row.month] = roundMoney(row.amount);
  }
  return months;
}

export async function listSubsidiaryMonthlyBudgetRevenue(year: number): Promise<number[]> {
  return (await salesCache()).loadCachedSubsidiaryMonthlyBudgetRevenue(year);
}

