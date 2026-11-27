import { q } from "@/lib/db";
import type { PosReport, PosReportKind } from "@/lib/pos-reports";

// [column, parsed field, SQL type]. Every value is sent as text and cast in SQL, so one statement handles any table.
type Column = readonly [string, string, string];
const TABLES: Record<PosReportKind, { table: string; columns: readonly Column[] }> = {
  daily_sales: { table: "app.pos_daily_sales", columns: [["location", "location", "text"], ["sale_date", "saleDate", "date"], ["tran_type", "tranType", "text"], ["user_name", "userName", "text"], ["bills", "bills", "integer"], ["qty", "qty", "numeric"],
    ["gross", "gross", "numeric"], ["item_discount", "itemDiscount", "numeric"], ["bill_discount", "billDiscount", "numeric"], ["net_amount", "net", "numeric"], ["bill_amount", "billAmount", "numeric"], ["tenders", "tenders", "jsonb"]] },
  item_sales: { table: "app.pos_item_sales", columns: [["location", "location", "text"], ["bill_no", "billNo", "text"], ["bill_date", "billDate", "date"], ["item_code", "itemCode", "text"], ["item_name", "itemName", "text"], ["qty", "qty", "numeric"],
    ["free_qty", "freeQty", "numeric"], ["sales", "sales", "numeric"], ["discount", "discount", "numeric"], ["tax", "tax", "numeric"], ["cost", "cost", "numeric"], ["distributor", "distributor", "text"]] },
  purchases: { table: "app.pos_purchases", columns: [["location", "location", "text"], ["purchase_no", "purchaseNo", "text"], ["purchase_date", "purchaseDate", "date"], ["invoice_no", "invoiceNo", "text"], ["invoice_date", "invoiceDate", "date"], ["supplier", "supplier", "text"],
    ["payment_type", "paymentType", "text"], ["item_code", "itemCode", "text"], ["item_name", "itemName", "text"], ["qty", "qty", "numeric"], ["free_qty", "freeQty", "numeric"], ["unit_cost", "unitCost", "numeric"], ["selling_price", "sellingPrice", "numeric"],
    ["amount", "amount", "numeric"], ["tax", "tax", "numeric"], ["net_amount", "netAmount", "numeric"], ["expiry_date", "expiryDate", "date"]] },
  stock: { table: "app.pos_stock", columns: [["location", "location", "text"], ["item_code", "itemCode", "text"], ["item_name", "itemName", "text"], ["ean", "ean", "text"], ["uom", "uom", "text"], ["mfr", "mfr", "text"], ["opening_qty", "opening", "numeric"],
    ["in_qty", "inQty", "numeric"], ["out_qty", "outQty", "numeric"], ["closing_qty", "closing", "numeric"], ["value_cost", "valueCost", "numeric"], ["value_selling", "valueSelling", "numeric"], ["status", "status", "text"]] },
};

/** Replaces the company's rows for that month, in one statement, so a re-uploaded month never double-counts and a failure leaves the old month in place. Table and column names come from the list above, never from the file. */
export async function savePosReport(report: PosReport) {
  const { table, columns } = TABLES[report.kind];
  const text = (value: unknown) => (value === null || value === undefined ? null : typeof value === "object" ? JSON.stringify(value) : String(value));
  const names = columns.map(([name]) => name).join(", ");
  const selects = columns.map(([name, , type], i) => (name === "location" ? `COALESCE(u.c${i}, '')` : `u.c${i}::${type}`)).join(", ");
  const aliases = columns.map((_, i) => `c${i}`).join(", ");
  const arrays = columns.map((_, i) => `$${i + 3}::text[]`).join(", ");
  await q(
    `WITH gone AS (DELETE FROM ${table} WHERE entity = $1 AND period = $2::date)
     INSERT INTO ${table}(entity, period, ${names}) SELECT $1, $2::date, ${selects} FROM unnest(${arrays}) AS u(${aliases})`,
    [report.entity, report.period, ...columns.map(([, field]) => report.rows.map((row) => text(row[field])))],
  );
  return report.rows.length;
}

export type PosMonth = { entity: string; period: string; sales: number | null; returns: number | null; itemSales: number | null; itemCost: number | null; purchases: number | null; stockCost: number | null; stockSelling: number | null };

/** One row per company and month, from the four report tables. A month missing a report shows that figure as null (not loaded), never 0. */
export const listPosMonths = () =>
  q<PosMonth>(
    `WITH s AS (SELECT entity, period, SUM(bill_amount) FILTER (WHERE tran_type NOT ILIKE '%return%') AS sales, SUM(bill_amount) FILTER (WHERE tran_type ILIKE '%return%') AS returns FROM app.pos_daily_sales GROUP BY 1, 2),
          m AS (SELECT entity, period, SUM(sales) AS "itemSales", SUM(cost) AS "itemCost" FROM app.pos_item_sales GROUP BY 1, 2),
          p AS (SELECT entity, period, SUM(net_amount) AS purchases FROM app.pos_purchases GROUP BY 1, 2),
          k AS (SELECT entity, period, SUM(value_cost) AS "stockCost", SUM(value_selling) AS "stockSelling" FROM app.pos_stock GROUP BY 1, 2)
     SELECT entity, period::text, sales::float8, returns::float8, "itemSales"::float8, "itemCost"::float8, purchases::float8, "stockCost"::float8, "stockSelling"::float8
     FROM s FULL JOIN m USING (entity, period) FULL JOIN p USING (entity, period) FULL JOIN k USING (entity, period) ORDER BY period, entity`,
  );
