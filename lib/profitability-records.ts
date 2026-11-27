import { q } from "@/lib/db";
import type { ProfitabilityMonth } from "@/lib/profitability";

/** Replaces the months in the file for that year and line, so re-uploading does not double-count. Lines are replaced one by one (a trucking file may also carry a Kuwait sheet). */
export async function saveProfitability(year: number, rows: ProfitabilityMonth[]) {
  if (!rows.length) return 0;
  await q(
    `WITH gone AS (DELETE FROM app.logistics_profitability p USING unnest($2::text[], $3::int[]) AS f(line, month) WHERE p.year = $1 AND p.line = f.line AND p.month = f.month)
     INSERT INTO app.logistics_profitability(year, line, month, sales, cost, invoices)
     SELECT $1, * FROM unnest($2::text[], $3::int[], $4::numeric[], $5::numeric[], $6::int[])`,
    [year, rows.map((r) => r.line), rows.map((r) => r.month), rows.map((r) => r.sales), rows.map((r) => r.cost), rows.map((r) => r.invoices)],
  );
  return rows.length;
}

export type ProfitabilityRow = ProfitabilityMonth & { year: number };

export const listProfitability = () =>
  q<ProfitabilityRow>(`SELECT year, month, line, sales::float8 AS sales, cost::float8 AS cost, invoices FROM app.logistics_profitability ORDER BY year, month, line`);
