// Pure helpers (no imports) for the document-type report, so `node --test` can load them.
export const DOC_TYPES = ["DO", "IN-DTS", "CR", "DR"] as const;

export type DocTypeRow = { docType: string; value: number; cost: number };
export type DateRange = { from: string; to: string };

const isRealDate = (text: string | undefined): text is string => !!text && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text;

/** Reads ?from=&to= (yyyy-mm-dd). Anything missing or invalid falls back to yesterday; a reversed range is swapped. */
export function parseRange(from: string | undefined, to: string | undefined, today: Date): DateRange {
  const yesterday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1)).toISOString().slice(0, 10);
  const start = isRealDate(from) ? from : yesterday, end = isRealDate(to) ? to : start;
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

/** One row per document type in a fixed order, with zeros for a type that has no lines in the range. */
export function fillDocTypes(rows: DocTypeRow[]): DocTypeRow[] {
  return DOC_TYPES.map((docType) => rows.find((r) => r.docType === docType) ?? { docType, value: 0, cost: 0 });
}
