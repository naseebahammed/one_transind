// Sales value and cost per ERP document type (CR, DO, DR, IN-DTS) for a date range, straight from the raw ERP table.
// The raw table holds every 2024 and 2025 line twice (see schema.ts), so the range may not start before 2026.
// shortcut: no de-duplication here because of that limit; if the range must reach back, copy the halving from schema.ts.
import { q } from "@/lib/db";
import { DOC_TYPES, FINALIZED_STATUS, fillDocTypes, type DateRange, type DocTypeRow } from "@/lib/doc-type-report-helpers";

/** Only finalized lines count unless includeUnfinalized is true. */
export async function getDocTypeTotals(range: DateRange, includeUnfinalized: boolean): Promise<DocTypeRow[]> {
  const rows = await q<DocTypeRow>(
    `SELECT "DOC_TYPE" AS "docType", COALESCE(SUM("NET_AMOUNT_WOT"), 0)::float8 AS value, COALESCE(SUM("NET_COST_WOT"), 0)::float8 AS cost
     FROM public.invs_fdd_fnb_sales_do_t
     WHERE "DOC_TYPE" = ANY($1) AND "DOC_DATE" >= $2::date AND "DOC_DATE" < ($3::date + 1)
       AND ($5::boolean OR "TRANS_STATUS" = $4)
     GROUP BY "DOC_TYPE"`,
    [[...DOC_TYPES], range.from, range.to, FINALIZED_STATUS, includeUnfinalized],
  );
  return fillDocTypes(rows);
}
