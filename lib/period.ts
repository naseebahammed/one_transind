import { cacheLife } from "next/cache";
import { validateSqlTableIdentifier } from "@/lib/input-validation";
import { periodOf } from "@/lib/period-calc";
import { pg } from "@/lib/pg";

async function maxDate(tableIdentifier: string) {
  "use cache";
  cacheLife("hours");
  const safeTable = validateSqlTableIdentifier(tableIdentifier);
  const { rows: [mx] } = await pg.query<{ d: string | null }>(`SELECT MAX("DOC_DATE")::text AS d FROM ${safeTable}`);
  return mx.d;
}

// "This month" = the month of the latest date in the sales table, counted up to that day.
export async function getPeriod(table: string) {
  const strippedAlias = table.trim().replace(/\s+s$/, "");
  const safeTable = validateSqlTableIdentifier(strippedAlias);
  return periodOf(await maxDate(safeTable));
}
