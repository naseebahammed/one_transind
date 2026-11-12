// Summarizes FMCG warehouse stock snapshots, near-expiry inventory, and short-delivery variances by warehouse location.
import { q, q1 } from "@/lib/db";
import { roundMoney } from "@/lib/money";

export type FmcgWarehouseLocation = {
  location: string;
  asOf: string;
  itemCount: number;
  qtyBalance: number;
  qtyAllocated: number;
  stockValue: number;
  expiringCost90d: number;
  shortDeliveryValue: number;
};

export type FmcgWarehouseSummary = {
  latestAsOf: string | null;
  locations: FmcgWarehouseLocation[];
  shortDeliveryOrders: number;
};

export async function getWarehouseSummary(): Promise<FmcgWarehouseSummary> {
  const [stockRows, expiryRows, varianceByLoc, varianceTotals] = await Promise.all([
    q<{
      location: string;
      asOf: string;
      itemCount: number;
      qtyBalance: number;
      qtyAllocated: number;
      stockValue: number;
    }>(
      `SELECT
         location,
         to_char(as_of, 'YYYY-MM-DD') AS "asOf",
         COUNT(DISTINCT item_code)::int AS "itemCount",
         COALESCE(SUM(qty_balance), 0)::float8 AS "qtyBalance",
         COALESCE(SUM(qty_allocated), 0)::float8 AS "qtyAllocated",
         COALESCE(SUM(value), 0)::float8 AS "stockValue"
       FROM app.stock_snapshots
       WHERE as_of = (SELECT MAX(as_of) FROM app.stock_snapshots)
       GROUP BY location, as_of
       ORDER BY "stockValue" DESC, location`,
    ),
    q<{ location: string; expiringCost: number }>(
      `SELECT
         COALESCE(NULLIF(btrim(location), ''), 'Unassigned') AS location,
         COALESCE(SUM(total_cost), 0)::float8 AS "expiringCost"
       FROM app.stock_expiry
       WHERE as_of = (SELECT MAX(as_of) FROM app.stock_expiry)
         AND expiry_date - as_of <= 90
       GROUP BY 1`,
    ),
    q<{ location: string; shortValue: number }>(
      `SELECT
         location,
         COALESCE(SUM(GREATEST(value_rv - value_do, 0)), 0)::float8 AS "shortValue"
       FROM app.delivery_variances
       WHERE do_date >= COALESCE((SELECT MAX(do_date) - 30 FROM app.delivery_variances), current_date - 30)
       GROUP BY location`,
    ),
    q1<{ shortOrders: number }>(
      `SELECT COUNT(DISTINCT do_no)::int AS "shortOrders"
       FROM app.delivery_variances
       WHERE value_rv > value_do
         AND do_date >= COALESCE((SELECT MAX(do_date) - 30 FROM app.delivery_variances), current_date - 30)`,
    ),
  ]);

  const expiryMap = new Map(expiryRows.map((r) => [r.location.trim().toUpperCase(), roundMoney(r.expiringCost)]));
  const varianceMap = new Map(varianceByLoc.map((r) => [r.location.trim().toUpperCase(), roundMoney(r.shortValue)]));

  const locations: FmcgWarehouseLocation[] = stockRows.map((row) => {
    const key = row.location.trim().toUpperCase();
    return {
      location: row.location,
      asOf: row.asOf,
      itemCount: row.itemCount,
      qtyBalance: roundMoney(row.qtyBalance),
      qtyAllocated: roundMoney(row.qtyAllocated),
      stockValue: roundMoney(row.stockValue),
      expiringCost90d: expiryMap.get(key) ?? 0,
      shortDeliveryValue: varianceMap.get(key) ?? 0,
    };
  });

  return {
    latestAsOf: stockRows[0]?.asOf ?? null,
    locations,
    shortDeliveryOrders: varianceTotals?.shortOrders ?? 0,
  };
}

