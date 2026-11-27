// Invoices (RV) the ERP has not yet converted to a delivery order, so the goods are sold but not delivered. Read straight from the ERP view, which only exists on the live server.
// RV_BAL_AMT_WOT is per line and adds up to the invoice amount, so summing it does not double count.
import { cacheLife, cacheTag } from "next/cache";
import { q, q1 } from "@/lib/db";
import { roundMoney } from "@/lib/money";
import { SALES_CACHE_TAG } from "@/lib/sales-targets";

export type PendingGroup = { name: string; value: number; invoices: number; oldestDays: number };
export type PendingDelivery = { value: number; invoices: number; oldestDays: number; bySalesman: PendingGroup[]; byDriver: PendingGroup[] };

const byColumn = (column: "Salesman" | "Driver") =>
  q<PendingGroup>(
    `SELECT COALESCE(NULLIF(btrim("${column}"), ''), 'Unassigned') AS name, SUM("RV_BAL_AMT_WOT")::float8 AS value, COUNT(DISTINCT "Inv No")::int AS invoices, (current_date - MIN("Inv Date"))::int AS "oldestDays"
     FROM public.invs_rv_not_conv_do_v GROUP BY 1 HAVING SUM("RV_BAL_AMT_WOT") <> 0 ORDER BY value DESC LIMIT 8`,
  );

export async function getPendingDelivery(): Promise<PendingDelivery> {
  "use cache";
  cacheTag(SALES_CACHE_TAG);
  cacheLife("minutes");
  const [total, bySalesman, byDriver] = await Promise.all([
    q1<{ value: number; invoices: number; oldestDays: number }>(
      `SELECT COALESCE(SUM("RV_BAL_AMT_WOT"), 0)::float8 AS value, COUNT(DISTINCT "Inv No")::int AS invoices, COALESCE(current_date - MIN("Inv Date"), 0)::int AS "oldestDays" FROM public.invs_rv_not_conv_do_v`,
    ),
    byColumn("Salesman"),
    byColumn("Driver"),
  ]);
  const clean = (rows: PendingGroup[]) => rows.map((r) => ({ ...r, value: roundMoney(r.value) }));
  return { value: roundMoney(total?.value ?? 0), invoices: total?.invoices ?? 0, oldestDays: total?.oldestDays ?? 0, bySalesman: clean(bySalesman), byDriver: clean(byDriver) };
}
