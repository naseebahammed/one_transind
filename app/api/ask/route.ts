import { connection } from "next/server";
import { getOverview, getCustomers } from "@/lib/data";
import { alManzilKey, occupancy, report, revenueLines, sum, years, loadReports } from "@/lib/al-manzil";

const MAX_Q = 1000;

async function context() {
  await loadReports();
  const [o, c] = await Promise.all([getOverview(), getCustomers()]);
  const alManzil = alManzilKey(), ys = years(alManzil), cur = ys.at(-1);
  const occ = cur ? occupancy(cur, alManzil) : [];
  const days = sum(occ.map((m) => m.days)) || 1, sold = sum(occ.map((m) => m.sold)) || 1;
  return JSON.stringify({
    year: o.year,
    latestCompleteMonth: o.month + 1,
    monthly: o.months.map(({ month, value, cost }) => ({ month, sales: Math.round(value), cost: Math.round(cost) })),
    brands: o.brands.map(({ name, value, lastMonth }) => ({ brand: name, thisMonth: Math.round(value), lastMonth: Math.round(lastMonth) })),
    topCustomers: c.customers.slice(0, 20).map((x) => ({ name: x.name, group: x.group, ytd: Math.round(x.ytd), thisMonth: Math.round(x.mtd), lastMonth: Math.round(x.lastMonth) })),
    realEstate: {
      source: "Al Manzil (Transind Real Estate)",
      byYear: ys.map((y) => { const r = report(y, alManzil); return { year: y, revenue: Math.round(sum(r.revenue)), totalCost: Math.round(sum(r.totalCost)), net: Math.round(sum(r.net)) }; }),
      latestYear: cur,
      occupancyPct: Math.round(sum(occ.map((m) => m.occ * m.days)) / days * 1000) / 10,
      averageDailyRate: cur ? Math.round(sum(occ.map((m) => m.room)) / sold) : 0,
      revenueBySource: cur ? revenueLines(cur, alManzil).map(([line, value]) => ({ line, value: Math.round(value) })) : [],
    },
  });
}

export async function POST(req: Request) {
  await connection();
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "OPENAI_API_KEY is not set" }, { status: 503 });

  const { question } = (await req.json().catch(() => ({}))) as { question?: unknown };
  if (typeof question !== "string" || !question.trim() || question.length > MAX_Q)
    return Response.json({ error: `Ask a question of 1-${MAX_Q} characters` }, { status: 400 });

  const data = await context(); // before the timeout starts, so slow queries do not eat OpenAI's 20 s
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are the analyst for One Transind's sales dashboard. Answer concisely using only the data below; if it does not cover the question, say so. Amounts are in QAR.\n\nDATA:\n" + data },
        { role: "user", content: question },
      ],
    }),
  }).catch(() => null);
  if (!res) return Response.json({ error: "OpenAI did not answer in time" }, { status: 504 });
  if (!res.ok) return Response.json({ error: `OpenAI error ${res.status}` }, { status: 502 });
  const j = await res.json().catch(() => null);
  if (!j) return Response.json({ error: "OpenAI sent an unreadable reply" }, { status: 502 });
  return Response.json({ answer: j.choices?.[0]?.message?.content ?? "" });
}
