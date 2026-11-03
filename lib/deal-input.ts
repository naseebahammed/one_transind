// Pure (no imports) so `node --test` can load it without the Next alias setup.
export type DealInput = { sector: string; acc: string; value: number; owner: number; close: string };

const INT_MAX = 2_147_483_647; // app.deals.value and owner are INTEGER columns

export function parseDeal(b: Record<string, unknown> | null, sectors: readonly string[]): DealInput | null {
  const acc = typeof b?.acc === "string" ? b.acc.trim() : "";
  const value = Math.round(Number(b?.value));
  const owner = b?.owner;
  const close = b?.close;
  if (!b || !acc || acc.length > 120 || typeof b.sector !== "string" || !sectors.includes(b.sector)) return null;
  if (!(value > 0 && value <= INT_MAX) || typeof owner !== "number" || !Number.isInteger(owner) || owner < 0 || owner > INT_MAX) return null;
  // Round-trip catches 2026-02-31 and 2026-99-99, which the shape check alone lets through.
  if (typeof close !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(close)) return null;
  const d = new Date(close + "T00:00:00Z");
  if (isNaN(+d) || d.toISOString().slice(0, 10) !== close) return null;
  return { sector: b.sector, acc, value, owner, close };
}
