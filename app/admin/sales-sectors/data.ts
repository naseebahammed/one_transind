import { connection } from "next/server";
import { getSectors } from "@/lib/data";
import { listOverrides } from "@/lib/sales-sectors";

export async function getSales() {
  await connection();
  const ov = new Map((await listOverrides()).map((o) => [o.code, o]));
  return (await getSectors()).map((s) => ({ code: s.key, db: s.label, label: ov.get(s.key)?.label ?? null, hidden: !!ov.get(s.key)?.hidden, sector: ov.get(s.key)?.sector ?? "" }));
}
