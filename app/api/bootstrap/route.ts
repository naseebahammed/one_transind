import { connection } from "next/server";
import { listDeals, listInvoices, listLog } from "@/lib/db";

export async function GET() {
  await connection(); // read per request, never prerender
  return Response.json({ deals: await listDeals(), invoices: await listInvoices(), log: await listLog() });
}
