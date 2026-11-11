import { cacheLife } from "next/cache";
import { cleanText } from "@/lib/input-validation";
import { pg } from "@/lib/pg";

// Read straight from the ERP: open invoices per customer (TC outstanding is the "Account Receivable - SALESMAN" part of this table) and invoices reserved but not yet converted to a delivery order.
// Customer code: a salesman's account holds the invoices of many customers, so ACTUAL_CUSTOMER wins when it is filled in.
const OPEN = `FROM public.glas_food_cust_oustanding_inv WHERE COALESCE("ACTUAL_CUSTOMER", "SLTR_SLMAST_ACNO") = $1`;

export type CustomerOutstanding = { name: string; balance: number; overdue: number; oldestOverdueDays: number };
export type PendingDelivery = { invoice: string; date: string; salesman: string | null; amount: number };
export const AGING = ["Not due", "1-30", "31-60", "61-90", "Over 90"] as const;

/** Everything one customer still owes, in days past due, plus the invoices behind it and the orders not yet delivered. */
export async function getReceivables(customer: string) {
  "use cache";
  cacheLife("minutes");
  const safeCustomer = cleanText(customer, 60);
  if (!safeCustomer) {
    return { aging: AGING.map((bucket) => ({ bucket, value: 0 })), pending: [] as PendingDelivery[] };
  }
  const [open, pending] = await Promise.all([
    pg.query<{ daysOverdue: number; balance: number }>(
      `SELECT GREATEST(current_date - "DUE_DATE", 0)::int AS "daysOverdue", "BALANCE_AMOUNT"::float8 AS balance ${OPEN}`, [safeCustomer]),
    pg.query<PendingDelivery>(
      `SELECT "Inv No"::text AS invoice, MAX("Inv Date")::text AS date, MAX("Salesman") AS salesman, MAX("Inv Amount WT")::float8 AS amount
       FROM public.invs_rv_not_conv_do_v WHERE "Customer No" = $1 GROUP BY "Inv No" ORDER BY 2 DESC`, [safeCustomer]),
  ]);
  const aging = AGING.map((bucket) => ({ bucket, value: 0 }));
  for (const r of open.rows) {
    const d = r.daysOverdue, i = d === 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4;
    aging[i].value += r.balance;
  }
  return { aging, pending: pending.rows };
}

/** The customers who owe the most past their due date. Grouped by customer name, so a customer with several codes is one row. Credits and payments on account are netted in. */
export async function getOutstandingByCustomer(limit = 50) {
  "use cache";
  cacheLife("minutes");
  const safeLimit = Math.min(200, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 50));
  const { rows } = await pg.query<CustomerOutstanding>(
    `SELECT COALESCE("ACTUAL_CUST_NAME", "COAD_PTY_FULL_NAME") AS name,
            SUM("BALANCE_AMOUNT")::float8 AS balance,
            COALESCE(SUM("BALANCE_AMOUNT") FILTER (WHERE "DUE_DATE" < current_date), 0)::float8 AS overdue,
            COALESCE(MAX(current_date - "DUE_DATE") FILTER (WHERE "DUE_DATE" < current_date AND "BALANCE_AMOUNT" > 0), 0)::int AS "oldestOverdueDays"
     FROM public.glas_food_cust_oustanding_inv GROUP BY 1 HAVING SUM("BALANCE_AMOUNT") <> 0 ORDER BY overdue DESC LIMIT $1`, [safeLimit]);
  return rows;
}
