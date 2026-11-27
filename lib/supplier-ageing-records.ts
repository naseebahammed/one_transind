import { q } from "@/lib/db";
import type { SupplierAgeing } from "@/lib/supplier-ageing";

/** Replaces every row of the report date, so re-uploading the same report does not double-count. */
export async function saveSupplierAgeing(asOf: string, rows: SupplierAgeing[]) {
  if (!rows.length) return 0;
  await q(
    `WITH gone AS (DELETE FROM app.supplier_ageing WHERE as_of = $1::date)
     INSERT INTO app.supplier_ageing(as_of, account_no, name, days_1_30, days_31_60, days_61_90, days_91_120, days_121_180, days_181_360, over_one_year, total)
     SELECT $1::date, * FROM unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[])`,
    [asOf, rows.map((r) => r.accountNo), rows.map((r) => r.name), rows.map((r) => r.days1To30), rows.map((r) => r.days31To60), rows.map((r) => r.days61To90), rows.map((r) => r.days91To120), rows.map((r) => r.days121To180), rows.map((r) => r.days181To360), rows.map((r) => r.overOneYear), rows.map((r) => r.total)],
  );
  return rows.length;
}

/** The most recent report date and its rows (empty when nothing was uploaded). */
export async function latestSupplierAgeing(): Promise<{ asOf: string | null; rows: SupplierAgeing[] }> {
  const rows = await q<SupplierAgeing & { asOf: string }>(
    `SELECT as_of::text AS "asOf", account_no AS "accountNo", name, days_1_30::float8 AS "days1To30", days_31_60::float8 AS "days31To60", days_61_90::float8 AS "days61To90",
            days_91_120::float8 AS "days91To120", days_121_180::float8 AS "days121To180", days_181_360::float8 AS "days181To360", over_one_year::float8 AS "overOneYear", total::float8 AS total
     FROM app.supplier_ageing WHERE as_of = (SELECT max(as_of) FROM app.supplier_ageing) ORDER BY total`,
  );
  return { asOf: rows[0]?.asOf ?? null, rows };
}
