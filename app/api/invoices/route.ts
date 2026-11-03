import { listInvoices } from "@/lib/db";


export async function GET(req: Request) {
  return Response.json(await listInvoices(new URL(req.url).searchParams.get("customerId")));
}
