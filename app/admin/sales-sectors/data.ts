import { connection } from "next/server";
import { getSectors } from "@/lib/data";
import { listOverrides } from "@/lib/sales-sectors";

export async function getSales() {
  await connection();
  const [overrides, sectors] = await Promise.all([listOverrides(), getSectors()]);
  const ov = new Map(overrides.map((o) => [o.code, o]));
  return sectors.map((s) => ({ code: s.key, db: s.label, label: ov.get(s.key)?.label ?? null, hidden: !!ov.get(s.key)?.hidden, sector: ov.get(s.key)?.sector ?? "" }));
}
