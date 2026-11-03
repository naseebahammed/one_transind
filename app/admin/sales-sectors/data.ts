import { connection } from "next/server";
import { getSectors } from "@/lib/data";
import { listOverrides } from "@/lib/sales-sectors";

export async function getSales() {
  await connection();
  const ov = new Map((await listOverrides()).map((o) => [o.code, o]));
  return (await getSectors()).map((s) => ({ code: s.k, db: s.label, label: ov.get(s.k)?.label ?? null, hidden: !!ov.get(s.k)?.hidden, sector: ov.get(s.k)?.sector ?? "" }));
}
