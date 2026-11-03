import { numbering, addLog, getDeal } from "@/lib/db";

// Moving a deal to stage 3 (won) creates a sales order, as the mock adapter did in the browser.
// shortcut: SO number is local; swap in a real EBS/Fusion call here when the integration exists.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!Number.isInteger(b?.stage) || b.stage < 0 || b.stage > 3) return Response.json({ error: "invalid stage" }, { status: 400 });

  // One transaction under the numbering lock: a double click or a second user cannot read the same "max" or raise the same deal twice.
  const so = await numbering(async (c) => {
    const { rows: [deal] } = await c.query<{ so: string | null }>("SELECT so FROM app.deals WHERE id=$1 FOR UPDATE", [id]);
    if (!deal) return undefined;
    let so = deal.so, created = false;
    if (b.stage === 3 && !so) {
      const { rows: [r] } = await c.query<{ m: number | null }>("SELECT MAX(CAST(SUBSTR(so,4) AS INTEGER)) AS m FROM app.deals WHERE so ~ '^SO-7[0-9]+$'");
      so = "SO-" + ((r.m ?? 70000) + 1);
      created = true;
    }
    await c.query("UPDATE app.deals SET stage=$1, so=$2 WHERE id=$3", [b.stage, so, id]);
    return { so, created };
  });
  if (!so) return Response.json({ error: "not found" }, { status: 404 });
  const entry = so.created ? await addLog(`Sales order ${so.so} → ERP`) : null;
  return Response.json({ deal: await getDeal(id), log: entry });
}
