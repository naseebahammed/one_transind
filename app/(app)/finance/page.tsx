import { getSalesSectors } from "@/lib/sales-sectors";
import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview } from "@/lib/data";
import { fmt, MONTHS, sum } from "@/lib/format";
import { MonthBars } from "@/components/admin/FinanceCharts";
import { MONTHS as AM_MONTHS, report, years } from "@/lib/al-manzil";
import { Empty, HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Finance · One Transind" };

export default function Page() {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content /></Suspense>;
}

async function Content() {
  await connection();
  const [o, sectors] = await Promise.all([getOverview(), getSalesSectors(true)]);
  const am = years().map((y) => [y, report(y)] as const), COLORS = ["#5b7cff", "#3ee08f", "#ffbe55", "#c084fc"];
  const rev = sum(sectors.map((s) => s.v)), cost = sum(sectors.map((s) => s.c));
  return (
    <>
      <div className="kpis">
        <Kpi label="Revenue year to date" value={`${fmt(rev / 1e6)} M`} up />
        <Kpi label="Gross margin" value={`${fmt(rev ? (1 - cost / rev) * 100 : 0, 1)}%`} />
        <Kpi label="Receivables outstanding" value="0" />
        <Kpi label="Days sales outstanding" value="0" />
      </div>
      <div className="grid">
        <Panel span={7} title="Revenue vs target">
          <div className="tw"><table>
            <thead><tr><th>Sector</th><th className="n">Actual</th><th className="n">Target</th><th style={{ width: "40%" }}>% of target</th></tr></thead>
            <tbody>{sectors.map((s) => (
              <tr key={s.k}><td>{s.label}</td><td className="n num">{fmt(s.v / 1e6, 1)}</td><td className="n num">0</td>
                <td><div className="hbar" style={{ gridTemplateColumns: "1fr auto" }}><span className="track"><span className="fill warn" style={{ display: "block", width: 0 }} /></span><span className="num">0%</span></div></td></tr>
            ))}</tbody>
          </table></div>
          <p className="note" style={{ marginTop: 8 }}>Figures in QAR M, January to {MONTHS[o.month]} {o.year}. No target source is connected, so targets show 0.</p>
        </Panel>
        <Panel span={6} title="Al Manzil - revenue by year">
          <MonthBars label="Al Manzil revenue by year" months={AM_MONTHS} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: r.revenue }))} />
        </Panel>
        <Panel span={6} title="Al Manzil - net profit / loss by year">
          <MonthBars label="Al Manzil net profit or loss" months={AM_MONTHS} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: r.net }))} />
        </Panel>
        <Panel span={5} title="Receivables aging">
          <HBars rows={["Current", "1–30 days", "31–60 days", "61–90 days", "Over 90 days"].map((l, i) => ({ l, v: 0, cls: i === 4 || i === 3 ? "bad" : i === 2 ? "warn" : "" }))} />
        </Panel>
        <Panel span={12} title="Overdue invoices">
          <div className="tw"><table>
            <thead><tr><th>Invoice</th><th>Account</th><th>Due</th><th className="n">Amount</th><th className="n">Balance</th><th>Status</th></tr></thead>
            <tbody><Empty cols={6} /></tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
