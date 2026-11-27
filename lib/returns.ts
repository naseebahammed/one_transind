// Sales returns (credit notes, document type CR) for a month, by supervisor and by brand, against the invoiced sales of the same group.
// Reads app.sales_clean, the app's copy of the ERP sales, which exists only where ERP data is loaded. CR lines are negative there; they are shown as positive amounts here.
// The delivery and reservation returns (DR, RR) of the Return Details workbook are not in that copy.
import { cacheLife, cacheTag } from "next/cache";
import { q } from "@/lib/db";
import { roundMoney } from "@/lib/money";
import { SALES_CACHE_TAG } from "@/lib/sales-targets";

export type ReturnRow = { name: string; returns: number; sales: number; ratePct: number | null };
export type Returns = { returns: number; sales: number; bySupervisor: ReturnRow[]; byBrand: ReturnRow[] };

const SUPERVISOR = `COALESCE(NULLIF(btrim(sm.team_lead), ''), 'Unassigned')`, BRAND = `COALESCE(NULLIF(btrim(l."BRAND"), ''), 'No brand')`;

const grouped = (group: string, periodIso: string) =>
  q<{ name: string; returns: number; sales: number }>(
    // The salesman master is keyed by code but the ERP copy has only the name, so one master row is picked per name (an active one first), as the target tracking does.
    `SELECT ${group} AS name, -COALESCE(SUM(l."NET_AMOUNT") FILTER (WHERE l."DOC_TYPE" = 'CR'), 0)::float8 AS returns, COALESCE(SUM(l."NET_AMOUNT") FILTER (WHERE l."DOC_TYPE" <> 'CR'), 0)::float8 AS sales
     FROM app.sales_clean l
     LEFT JOIN (SELECT DISTINCT ON (upper(trim(name))) upper(trim(name)) AS name_key, team_lead FROM app.salesmen ORDER BY upper(trim(name)), (upper(status) = 'ACTIVE') DESC, code) sm ON sm.name_key = upper(trim(l."SMAN_NAME"))
     WHERE l."DOC_DATE" >= $1::date AND l."DOC_DATE" < ($1::date + interval '1 month') GROUP BY 1`,
    [periodIso],
  );

const rows = (list: { name: string; returns: number; sales: number }[]): ReturnRow[] =>
  list
    .filter((r) => r.returns > 0)
    .map((r) => ({ name: r.name, returns: roundMoney(r.returns), sales: roundMoney(r.sales), ratePct: r.sales > 0 ? roundMoney((r.returns / r.sales) * 100) : null }))
    .sort((a, b) => b.returns - a.returns);

export async function getReturns(periodIso: string): Promise<Returns> {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("hours");
  const [supervisors, brands] = await Promise.all([grouped(SUPERVISOR, periodIso), grouped(BRAND, periodIso)]);
  return {
    returns: roundMoney(supervisors.reduce((n, r) => n + r.returns, 0)),
    sales: roundMoney(supervisors.reduce((n, r) => n + r.sales, 0)),
    bySupervisor: rows(supervisors).slice(0, 10),
    byBrand: rows(brands).slice(0, 10),
  };
}
