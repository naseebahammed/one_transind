import { q } from "@/lib/db";
import type { Settlement } from "@/lib/settlements";

/** Replaces every payment dated within the file's upload-date range, so re-uploading the same file does not double-count. */
export async function saveSettlements(rows: Settlement[]) {
  if (!rows.length) return 0;
  const dates = rows.map((s) => s.uploadDate).sort();
  await q(
    `WITH gone AS (DELETE FROM app.settlements WHERE upload_date BETWEEN $1 AND $2)
     INSERT INTO app.settlements(upload_date, employee_id, employee_name, division, settlement_type, account, amount, scheduled_date, payment_method)
     SELECT * FROM unnest($3::date[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::numeric[], $10::date[], $11::text[])`,
    [dates[0], dates[dates.length - 1], rows.map((s) => s.uploadDate), rows.map((s) => s.employeeId), rows.map((s) => s.name), rows.map((s) => s.division), rows.map((s) => s.type), rows.map((s) => s.account), rows.map((s) => s.amount), rows.map((s) => s.scheduledDate), rows.map((s) => s.paymentMethod)],
  );
  return rows.length;
}

export const listSettlements = () =>
  q<Settlement>(`SELECT upload_date::text AS "uploadDate", employee_id AS "employeeId", employee_name AS name, division, settlement_type AS type, account,
      amount::float8 AS amount, scheduled_date::text AS "scheduledDate", payment_method AS "paymentMethod" FROM app.settlements ORDER BY upload_date`);
