import { q, numbering, getDeal } from "@/lib/db";
import { parseDeal } from "@/lib/deal-input";

export async function POST(req: Request) {
  const sectors = (await q<{ key: string }>("SELECT key FROM app.sectors")).map((s) => s.key);
  const d = parseDeal(await req.json().catch(() => null), sectors);
  if (!d) return Response.json({ error: "invalid deal" }, { status: 400 });
  const id = await numbering(async (c) => {
    const { rows: [r] } = await c.query<{ m: number | null }>("SELECT MAX(CAST(SUBSTR(id,3) AS INTEGER)) AS m FROM app.deals WHERE id ~ '^D-[0-9]+$'");
    const id = "D-" + ((r.m ?? 1000) + 1);
    await c.query("INSERT INTO app.deals(id,sector,acc_ar,acc_en,cust,value,stage,owner,close,so) VALUES($1,$2,$3,$3,NULL,$4,0,$5,$6,NULL)", [id, d.sector, d.acc, d.value, d.owner, d.close]);
    return id;
  });
  return Response.json(await getDeal(id), { status: 201 });
}
