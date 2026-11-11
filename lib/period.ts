import { cacheLife } from "next/cache";
import { validateSqlTableIdentifier } from "@/lib/input-validation";
import { periodOf } from "@/lib/period-calc";
import { pg } from "@/lib/pg";
import { salesPeriod } from "@/lib/server-config";

async function maxDate(tableIdentifier: string) {
  "use cache";
  cacheLife("hours");
  const safeTable = validateSqlTableIdentifier(tableIdentifier);
  const { rows: [mx] } = await pg.query<{ d: string | null }>(`SELECT MAX("DOC_DATE")::text AS d FROM ${safeTable}`);
  return mx.d;
}

// "This month" = latest complete month in the sales table; SALES_PERIOD=YYYY-MM pins it.
export async function getPeriod(table: string) {
  const strippedAlias = table.trim().replace(/\s+s$/, "");
  const safeTable = validateSqlTableIdentifier(strippedAlias);
  const pin = salesPeriod();
  return periodOf(pin ? null : await maxDate(safeTable), pin);
}
