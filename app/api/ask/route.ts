import { apiGuard } from "@/lib/guard";
import { askAnalyst, hasOpenAiKey } from "@/lib/ask-ai";
import { cleanMultilineText } from "@/lib/input-validation";
import { connection } from "next/server";
import { getOverview, getOverviewBrands, getCustomers } from "@/lib/data";
import { alManzilKey, dailyYears, occupancy, report, revenueLines, years, loadReports } from "@/lib/reports";
import { sum } from "@/lib/format";

const MAX_Q = 1000;

async function context() {
  const [reports, o, brands, c] = await Promise.all([loadReports(), getOverview(), getOverviewBrands(), getCustomers()]);
  const alManzil = alManzilKey(reports), ys = years(reports, alManzil), cur = ys.at(-1), stayYear = dailyYears(reports, alManzil).at(-1);
  const occ = stayYear ? occupancy(reports, stayYear, alManzil) : [];
  const avail = sum(occ.map((m) => m.avail)) || 1, sold = sum(occ.map((m) => m.sold)) || 1;
  return JSON.stringify({
    year: o.year,
    latestMonth: o.month + 1,
    latestMonthCoversDays: o.day, // the latest month is partial: brands, customers and last-month figures use the same days of the month before
    monthly: o.months.map(({ month, value, cost }) => ({ month, sales: Math.round(value), cost: Math.round(cost) })),
    brands: brands.map(({ name, value, lastMonth }) => ({ brand: name, thisMonth: Math.round(value), lastMonth: Math.round(lastMonth) })),
    topCustomers: c.customers.slice(0, 20).map((x) => ({ name: x.name, group: x.group, ytd: Math.round(x.ytd), thisMonth: Math.round(x.mtd), lastMonth: Math.round(x.lastMonth) })),
    realEstate: {
      source: "Al Manzil (Transind Real Estate)",
      byYear: ys.map((y) => { const r = report(reports, y, alManzil); return { year: y, revenue: Math.round(sum(r.revenue)), totalCost: Math.round(sum(r.totalCost)), net: Math.round(sum(r.net)) }; }),
      latestYear: cur,
      occupancyPct: Math.round(sum(occ.map((m) => m.sold)) / avail * 1000) / 10,
      averageDailyRate: stayYear ? Math.round(sum(occ.map((m) => m.room)) / sold) : 0,
      revenueBySource: cur ? revenueLines(reports, cur, alManzil).map(([line, value]) => ({ line, value: Math.round(value) })) : [],
    },
  });
}

export async function POST(req: Request) {
  return apiGuard(req, "user", "ask", async () => {
    await connection();
    if (!hasOpenAiKey()) return Response.json({ error: "Ask AI is not configured." }, { status: 503 });

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > 8_192) {
      return Response.json({ error: "Request payload is too large." }, { status: 413 });
    }
    let parsedBody: { question?: unknown } = {};
    try {
      parsedBody = JSON.parse(rawBody) as { question?: unknown };
    } catch {
      parsedBody = {};
    }
    const { question: rawQuestion } = parsedBody;
    if (typeof rawQuestion !== "string" || rawQuestion.length > MAX_Q) {
      return Response.json({ error: `Ask a question of 1-${MAX_Q} characters` }, { status: 400 });
    }
    const question = cleanMultilineText(rawQuestion, MAX_Q);
    if (!question) {
      return Response.json({ error: `Ask a question of 1-${MAX_Q} characters` }, { status: 400 });
    }

    const data = await context(); // before the timeout starts, so slow queries do not eat OpenAI's 20 s
    const reply = await askAnalyst(data, question);
    if ("error" in reply) return Response.json({ error: reply.error }, { status: reply.status });
    return Response.json({ answer: reply.answer });
  });
}
