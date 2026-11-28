// Sales value and cost per ERP document type (CR, DO, DR, IN-DTS) for a date range.
// Reads app.sales_doc_types (migration 048): FINALIZED lines only, the doubled pre-2026 lines already halved. Separate from app.sales_clean, so no other page changes.
import { q } from "@/lib/db";
import { DOC_TYPES, fillDocTypes, type DateRange, type DocTypeRow } from "@/lib/doc-type-report-helpers";

export async function getDocTypeTotals(range: DateRange): Promise<DocTypeRow[]> {
  const rows = await q<DocTypeRow>(
    `SELECT "DOC_TYPE" AS "docType", COALESCE(SUM("NET_AMOUNT"), 0)::float8 AS value, COALESCE(SUM("NET_COST"), 0)::float8 AS cost
     FROM app.sales_doc_types
     WHERE "DOC_TYPE" = ANY($1) AND "DOC_DATE" >= $2::date AND "DOC_DATE" < ($3::date + 1)
     GROUP BY "DOC_TYPE"`,
    [[...DOC_TYPES], range.from, range.to],
  );
  return fillDocTypes(rows);
}
