import { cacheLife } from "next/cache";
import { pg } from "@/lib/pg";
import { periodOf } from "@/lib/period-calc";

async function maxDate(table: string) {
  "use cache";
  cacheLife("minutes");
  const { rows: [mx] } = await pg.query<{ d: string | null }>(`SELECT MAX("DOC_DATE")::text AS d FROM ${table}`);
  return mx.d;
}

// "This month" = latest complete month in the sales table; SALES_PERIOD=YYYY-MM pins it.
export async function getPeriod(table: string) {
  if (!table) throw new Error("SALES_TABLE is not set");
  const pin = process.env.SALES_PERIOD;
  return periodOf(pin?.trim() ? null : await maxDate(table), pin);
}
