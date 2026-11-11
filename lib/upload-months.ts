import { q } from "@/lib/db";

/** Uploads tracked on the data-status page besides the monthly templates. Not every company uses each, so only the kinds a company has ever uploaded count as required. */
export const UPLOADS = [["receipts", "Takings"], ["daily", "Daily sales"], ["sales", "Monthly sales"], ["cogs", "COGS"], ["units", "Units"]] as const;
export type UploadKind = (typeof UPLOADS)[number][0];

/** For each company and upload kind ever uploaded: the months (0-11) of `year` that have data. A missing entry means the company never uploaded that kind. */
export async function listUploadMonths(year: number) {
  const rows = await q<{ company_id: number; kind: UploadKind; month: number | null }>(
    `SELECT DISTINCT company_id, kind, CASE WHEN EXTRACT(year FROM d) = $1 THEN EXTRACT(month FROM d)::int - 1 END AS month FROM (
       SELECT company_id, section AS kind, period AS d FROM app.company_figures WHERE section IN ('sales','cogs','units')
       UNION ALL SELECT company_id, 'receipts', date FROM app.daily_receipts
       UNION ALL SELECT company_id, 'daily', date FROM app.daily_sales
     ) t`, [year]);
  const out = new Map<string, Set<number>>();
  for (const r of rows) {
    const key = `${r.company_id}|${r.kind}`;
    if (!out.has(key)) out.set(key, new Set());
    if (r.month !== null) out.get(key)!.add(r.month);
  }
  return (companyId: number, kind: UploadKind) => out.get(`${companyId}|${kind}`);
}
