// Pure (no imports) so `node --test` can load it without the Next alias setup.
/** "This month" = the month of the table's latest date (YYYY-MM-DD); `day` is how many days of it the data covers, so comparisons can use the same days. */
export function periodOf(maxDate: string | null | undefined) {
  if (!maxDate) throw new Error("The sales table has no rows, so there is no period to show");
  const last = new Date(maxDate + "T00:00:00Z");
  const p = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
  const prev = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() - 1, 1));
  const ym = (d: Date) => d.toISOString().slice(0, 7);
  return { p, prev, year: p.getUTCFullYear(), month: p.getUTCMonth(), day: last.getUTCDate(), cur: ym(p), before: ym(prev) };
}
