// Sales value and cost per ERP document type (CR, DO, DR, IN-DTS) for a date range.
// Reads app.sales_doc_types (migrations 048, 049): every status, the doubled pre-2026 lines already halved. Separate from app.sales_clean, so no other page changes.
import { q } from "@/lib/db";
import { DOC_TYPES, fillDocTypes, type DateRange, type DocTypeRow } from "@/lib/doc-type-report-helpers";

/** Every status (Finalized and Converted) unless finalizedOnly. The ERP writes "Finalized", so the check ignores case. */
export async function getDocTypeTotals(range: DateRange, finalizedOnly: boolean): Promise<DocTypeRow[]> {
  const rows = await q<DocTypeRow>(
    `SELECT "DOC_TYPE" AS "docType", COALESCE(SUM("NET_AMOUNT"), 0)::float8 AS value, COALESCE(SUM("NET_COST"), 0)::float8 AS cost
     FROM app.sales_doc_types
     WHERE "DOC_TYPE" = ANY($1) AND "DOC_DATE" >= $2::date AND "DOC_DATE" < ($3::date + 1)
       AND (NOT $4::boolean OR upper("TRANS_STATUS") = 'FINALIZED')
     GROUP BY "DOC_TYPE"`,
    [[...DOC_TYPES], range.from, range.to, finalizedOnly],
  );
  return fillDocTypes(rows);
}
