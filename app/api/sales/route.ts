import { connection } from "next/server";
import { getHistory, getOverview } from "@/lib/data";

// Same numbers as the pages: getOverview/getHistory are cached in lib/data.ts. "This month" is the latest complete month.
export async function GET() {
  await connection();
  const [{ year, month, months: mon, brands }, hist] = await Promise.all([getOverview(), getHistory()]);
  const months = Array<number | null>(12).fill(null);
  mon.forEach((x, i) => { months[i] = +(x.v / 1e6).toFixed(2); });
  return Response.json({
    year, period: month, months, tree: brands,
    mtd: brands.reduce((a, b) => a + b.v, 0), lm: brands.reduce((a, b) => a + b.lm, 0),
    returns: hist.filter((h) => h.y === year).reduce((a, h) => a + h.cr, 0),
  });
}
