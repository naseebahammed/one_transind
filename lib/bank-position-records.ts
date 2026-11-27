import { q } from "@/lib/db";
import type { BankPositionRow } from "@/lib/bank-position";

/** Replaces every row of the report date, so loading the same position again does not double-count. */
export async function saveBankPosition(asOf: string, rows: BankPositionRow[]) {
  if (!rows.length) return 0;
  await q(
    `WITH gone AS (DELETE FROM app.bank_position WHERE as_of = $1::date)
     INSERT INTO app.bank_position(as_of, line, bank, account, facility, credit_limit, rate, used, available)
     SELECT $1::date, * FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[])`,
    [asOf, rows.map((_, i) => i + 1), rows.map((r) => r.bank), rows.map((r) => r.account), rows.map((r) => r.facility), rows.map((r) => r.creditLimit), rows.map((r) => r.rate), rows.map((r) => r.used), rows.map((r) => r.available)],
  );
  return rows.length;
}

/** The most recent report date and its rows in sheet order (empty when nothing was loaded). */
export async function latestBankPosition(): Promise<{ asOf: string | null; rows: BankPositionRow[] }> {
  const rows = await q<BankPositionRow & { asOf: string }>(
    `SELECT as_of::text AS "asOf", bank, account, facility, credit_limit::float8 AS "creditLimit", rate::float8 AS rate, used::float8 AS used, available::float8 AS available
     FROM app.bank_position WHERE as_of = (SELECT max(as_of) FROM app.bank_position) ORDER BY line`,
  );
  return { asOf: rows[0]?.asOf ?? null, rows };
}
