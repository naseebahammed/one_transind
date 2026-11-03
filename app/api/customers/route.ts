import { connection } from "next/server";
import { getCustomers } from "@/lib/data";

export async function GET() {
  await connection();
  const { year, month, customers, customerCount } = await getCustomers();
  return Response.json({ year, period: month, customers, customerCount });
}
