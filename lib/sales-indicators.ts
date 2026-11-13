// Computes ERP channel split, delivery-variance out-of-stock loss, and assignment-backed target fallbacks for /sales and /finance.
import type { SalesIndicatorKey } from "./manual-entry-input.ts";
import { roundMoney, sumMoney } from "./money.ts";
import type { SalesDepartmentTargetRow } from "./sales-targets.ts";

export type ChannelIndicatorKey = "van_sales" | "key_accounts" | "horeca" | "wholesale";

export function classifySalesChannel(input: {
  custCategory?: string | null;
  docType?: string | null;
  salesmanCategory?: string | null;
  assignmentChannel?: string | null;
}): ChannelIndicatorKey | null {
  const cat = (input.custCategory ?? "").trim().toUpperCase();
  const doc = (input.docType ?? "").trim().toUpperCase();
  const sman = (input.salesmanCategory ?? "").trim().toUpperCase();
  const ch = (input.assignmentChannel ?? "").trim().toUpperCase();
  const combined = `${cat} | ${ch}`;

  if (
    /\b(HORECA|HOTEL|HOTELS|RESTAURANT|RESTAURANTS|CAFE|CAFES|COFFEE|CATERING|BAKERY|AIRLINE|CLUB|HOSPITAL|SCHOOL|INSTITUTION|FOOD\s*SERVICE)\b/.test(
      combined,
    )
  ) {
    return "horeca";
  }

  if (/\b(WHOLESALE|WHOLE\s*SALE|WS|SUB[\s-]*DIST\w*|TRADER|TRADERS|RE[\s-]*EXPORT)\b/.test(combined)) {
    return "wholesale";
  }

  if (
    /\b(KEY\s*ACCOUNT\w*|HYPER\s*MARKET\w*|SUPER\s*MARKET\w*|MODERN\s*TRADE|MT|KA|CO[\s-]*OP\w*|CHAIN\w*|MALL)\b/.test(
      combined,
    )
  ) {
    return "key_accounts";
  }

  if (
    doc === "IN-DTS" ||
    /\b(DTS|VAN)\b/.test(sman) ||
    /\b(VAN|DTS|GROCER\w*|BAQALA|BAKALA|MINI\s*MARKET\w*|COLD\s*STORE\w*|CONVENIENCE|KIOSK|PETROL|PHARMAC\w*|GENERAL\s*TRADE|GT)\b/.test(
      combined,
    )
  ) {
    return "van_sales";
  }

  return null;
}

export function mergeSalesSectorIndicators(
  computed: Partial<Record<SalesIndicatorKey, number>>,
  manualOverrides: Map<SalesIndicatorKey, number>,
): Map<SalesIndicatorKey, number> {
  const merged = new Map<SalesIndicatorKey, number>();
  for (const [key, val] of Object.entries(computed) as [SalesIndicatorKey, number | undefined][]) {
    if (val !== undefined && Number.isFinite(val)) {
      merged.set(key, roundMoney(val));
    }
  }
  for (const [key, val] of manualOverrides.entries()) {
    merged.set(key, roundMoney(val));
  }
  return merged;
}

export function resolveDepartmentTargetsWithFallback(
  explicitTargets: SalesDepartmentTargetRow[],
  assignmentTargets: { code: string; year: number; month: number; target: number }[],
): SalesDepartmentTargetRow[] {
  const byKey = new Map<string, SalesDepartmentTargetRow>();
  for (const row of assignmentTargets) {
    if (row.target <= 0) continue;
    const period = `${row.year}-${String(row.month + 1).padStart(2, "0")}-01`;
    const k = `${row.code}|${row.year}|${row.month}`;
    const prev = byKey.get(k);
    byKey.set(k, {
      code: row.code,
      year: row.year,
      month: row.month,
      period,
      target: roundMoney((prev?.target ?? 0) + row.target),
    });
  }
  // Explicit admin department targets override DSR assignment sums for the same (code, year, month).
  for (const row of explicitTargets) {
    const k = `${row.code}|${row.year}|${row.month}`;
    byKey.set(k, row);
  }
  return [...byKey.values()].sort((a, b) => a.code.localeCompare(b.code) || a.month - b.month);
}

const salesCache = () => import("@/lib/sales-cache");

const loadDbDeps = async () => {
  const [pgMod, periodMod, configMod, cleanMod, targetsMod, sectorsMod] = await Promise.all([
    import("@/lib/pg"),
    import("@/lib/period"),
    import("@/lib/server-config"),
    import("@/lib/input-validation"),
    import("@/lib/sales-targets"),
    import("@/lib/sales-sectors"),
  ]);
  return { pgMod, periodMod, configMod, cleanMod, targetsMod, sectorsMod };
};

export async function queryComputedSalesIndicators(
  month: number,
  departmentCode = "",
  departmentLabel = "",
): Promise<Partial<Record<SalesIndicatorKey, number>>> {
  const { pgMod, periodMod, configMod, cleanMod } = await loadDbDeps();
  const safeMonth = Number.isInteger(month) && month >= 0 && month <= 11 ? month : 0;
  const safeDept = cleanMod.cleanText(departmentCode, 40);
  const safeLabel = cleanMod.cleanText(departmentLabel, 80);
  const table = `${configMod.salesTable()} s`;

  const period = await periodMod.getPeriod(table);
  const days = safeMonth === period.month ? period.day : 31;
  const monthStart = `${period.year}-${String(safeMonth + 1).padStart(2, "0")}-01`;

  const salesParams: unknown[] = [monthStart, days];
  let deptWhere = "";
  if (safeDept) {
    salesParams.push(safeDept);
    deptWhere = ` AND COALESCE(s."DEPT_CODE", '-')::text = $3`;
  }

  const [channelRes, varianceRes] = await Promise.all([
    pgMod.pg.query<{
      custCategory: string | null;
      docType: string | null;
      salesmanCategory: string | null;
      assignmentChannel: string | null;
      amount: number;
    }>(
      `WITH assign_ch AS (
         SELECT salesman_code, MAX(channel) AS channel
         FROM app.sales_assignments
         WHERE period = $1::date
         GROUP BY 1
       )
       SELECT
         s."CUST_CATEGORY" AS "custCategory",
         s."DOC_TYPE" AS "docType",
         sm.sales_category AS "salesmanCategory",
         ac.channel AS "assignmentChannel",
         COALESCE(SUM(s."NET_AMOUNT"), 0)::float8 AS amount
       FROM ${table}
       LEFT JOIN app.salesmen sm ON lower(btrim(sm.name)) = lower(btrim(s."SMAN_NAME"))
       LEFT JOIN assign_ch ac ON ac.salesman_code = sm.code
       WHERE s."DOC_DATE" >= $1::date
         AND s."DOC_DATE" < LEAST(($1::date + interval '1 month')::date, $1::date + $2::int)${deptWhere}
       GROUP BY 1, 2, 3, 4`,
      salesParams,
    ),
    pgMod.pg.query<{ shortValue: number | null; rowCount: number }>(
      `SELECT
         SUM(GREATEST(dv.value_rv - dv.value_do, 0))::float8 AS "shortValue",
         COUNT(*)::int AS "rowCount"
       FROM app.delivery_variances dv
       LEFT JOIN app.items i ON i.code = dv.item_code
       LEFT JOIN app.brands b ON upper(btrim(b.code)) = upper(btrim(COALESCE(dv.brand, i.brand, '')))
       WHERE dv.do_date >= $1::date
         AND dv.do_date < LEAST(($1::date + interval '1 month')::date, $1::date + $2::int)
         AND (
           $3::text = ''
           OR upper(btrim(COALESCE(b.department, i.department, ''))) IN (upper($3::text), upper($4::text))
         )`,
      [monthStart, days, safeDept, safeLabel || safeDept],
    ),
  ]);

  const out: Partial<Record<SalesIndicatorKey, number>> = {};
  if (channelRes.rows.length > 0) {
    const totals: Record<ChannelIndicatorKey, number> = {
      van_sales: 0,
      key_accounts: 0,
      horeca: 0,
      wholesale: 0,
    };
    let anyClassified = false;
    for (const row of channelRes.rows) {
      const ch = classifySalesChannel(row);
      if (ch) {
        totals[ch] = sumMoney([totals[ch], row.amount]);
        anyClassified = true;
      }
    }
    if (anyClassified) {
      out.van_sales = totals.van_sales;
      out.key_accounts = totals.key_accounts;
      out.horeca = totals.horeca;
      out.wholesale = totals.wholesale;
    }
  }

  const vRow = varianceRes.rows[0];
  if (vRow && vRow.rowCount > 0) {
    out.out_of_stock_loss = roundMoney(vRow.shortValue ?? 0);
  }

  return out;
}

export async function getComputedSalesIndicators(
  month: number,
  departmentCode = "",
  departmentLabel = "",
): Promise<Partial<Record<SalesIndicatorKey, number>>> {
  return (await salesCache()).loadCachedComputedSalesIndicators(month, departmentCode, departmentLabel);
}

export async function queryEffectiveDepartmentTargets(year: number): Promise<SalesDepartmentTargetRow[]> {
  const { pgMod, targetsMod, sectorsMod } = await loadDbDeps();
  const [explicit, sectors, assignRes] = await Promise.all([
    targetsMod.querySalesDepartmentTargets(year),
    sectorsMod.getSalesSectors(false),
    pgMod.pg.query<{ dept: string; month: number; target: number }>(
      `SELECT
         btrim(department) AS dept,
         EXTRACT(month FROM period)::int - 1 AS month,
         COALESCE(SUM(target), 0)::float8 AS target
       FROM app.sales_assignments
       WHERE period >= make_date($1::int, 1, 1)
         AND period < make_date($1::int + 1, 1, 1)
         AND target IS NOT NULL
         AND department IS NOT NULL
         AND btrim(department) <> ''
       GROUP BY 1, 2`,
      [year],
    ),
  ]);

  const codeByToken = new Map<string, string>();
  for (const s of sectors) {
    codeByToken.set(s.key.trim().toUpperCase(), s.key);
    codeByToken.set(s.label.trim().toUpperCase(), s.key);
  }

  const mappedAssignments = assignRes.rows
    .map((r) => {
      const code = codeByToken.get(r.dept.toUpperCase());
      return code ? { code, year, month: r.month, target: r.target } : null;
    })
    .filter((r): r is { code: string; year: number; month: number; target: number } => r !== null);

  return resolveDepartmentTargetsWithFallback(explicit, mappedAssignments);
}

export async function listEffectiveDepartmentTargets(year: number): Promise<SalesDepartmentTargetRow[]> {
  return (await salesCache()).loadCachedEffectiveDepartmentTargets(year);
}

