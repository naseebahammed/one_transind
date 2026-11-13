import { cacheLife, cacheTag } from "next/cache";
import { querySubsidiaryMonthlyBudgetRevenue, querySubsidiaryMonthlyRevenue } from "@/lib/group-revenue";
import { queryPeriodTracking } from "@/lib/manager-tracking";
import { REPORTS_CACHE_TAG } from "@/lib/reports";
import { queryComputedSalesIndicators, queryEffectiveDepartmentTargets } from "@/lib/sales-indicators";
import { querySalesDepartmentTargets, querySalesSectorIndicators, SALES_CACHE_TAG } from "@/lib/sales-targets";

/** Cross-request cached sales, target, indicator, and subsidiary revenue queries, expired via updateTag on admin edits. */

export async function loadCachedPeriodTracking(periodIso: string) {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  return queryPeriodTracking(periodIso);
}

export async function loadCachedComputedSalesIndicators(month: number, departmentCode = "", departmentLabel = "") {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  return queryComputedSalesIndicators(month, departmentCode, departmentLabel);
}

export async function loadCachedEffectiveDepartmentTargets(year: number) {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  return queryEffectiveDepartmentTargets(year);
}

export async function loadCachedSalesDepartmentTargets(year: number) {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  return querySalesDepartmentTargets(year);
}

export async function loadCachedSalesSectorIndicators(period: string) {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  return querySalesSectorIndicators(period);
}

export async function loadCachedSubsidiaryMonthlyRevenue(yearsList: number[]) {
  "use cache";
  cacheTag(REPORTS_CACHE_TAG);
  cacheLife("hours");
  return querySubsidiaryMonthlyRevenue(yearsList);
}

export async function loadCachedSubsidiaryMonthlyBudgetRevenue(year: number) {
  "use cache";
  cacheTag(REPORTS_CACHE_TAG);
  cacheLife("hours");
  return querySubsidiaryMonthlyBudgetRevenue(year);
}

