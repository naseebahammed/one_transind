// Pure (no imports) so `node --test` can load it without the Next alias setup.
/** "This month" from the table's latest date (YYYY-MM-DD): that month if the date is its last day, else the month before. `pin` (YYYY-MM) overrides. */
export function periodOf(maxDate: string | null | undefined, pin?: string) {
  const pinned = pin?.trim();
  if (pinned && !/^\d{4}-(0[1-9]|1[0-2])$/.test(pinned)) throw new Error(`SALES_PERIOD must be YYYY-MM, got "${pinned}"`);
  if (!pinned && !maxDate) throw new Error("The sales table has no rows, so there is no period to show");
  const last = new Date(maxDate + "T00:00:00Z");
  const monthEnd = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)).getUTCDate() === last.getUTCDate();
  const p = pinned
    ? new Date(pinned + "-01T00:00:00Z")
    : new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - (monthEnd ? 0 : 1), 1));
  const prev = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() - 1, 1));
  const ym = (d: Date) => d.toISOString().slice(0, 7);
  return { p, prev, year: p.getUTCFullYear(), month: p.getUTCMonth(), cur: ym(p), before: ym(prev) };
}
