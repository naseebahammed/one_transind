import { getSalesSectors } from "@/lib/sales-sectors";
import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview } from "@/lib/data";
import { fmt, MONTHS, sum } from "@/lib/format";
import { MonthBars } from "@/components/admin/FinanceCharts";
import { alManzilKey, report, years, loadReports } from "@/lib/reports";
import { Empty, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Finance · One Transind" };

export default function Page() {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content /></Suspense>;
}

async function Content() {
  await connection();
  await loadReports();
  const [o, sectors] = await Promise.all([getOverview(), getSalesSectors(true)]);
  const alManzil = alManzilKey(), am = years(alManzil).map((y) => [y, report(y, alManzil)] as const), COLORS = ["#5b7cff", "#3ee08f", "#ffbe55", "#c084fc"];
  const rev = sum(sectors.map((s) => s.value)), cost = sum(sectors.map((s) => s.cost));
  return (
    <>
      <div className="kpis">
        <Kpi label="Revenue year to date" value={`${fmt(rev / 1e6)} M`} up />
        <Kpi label="Gross margin" value={`${fmt(rev ? (1 - cost / rev) * 100 : 0, 1)}%`} />
        <Kpi label="Receivables outstanding" value={<NotConnected />} />
        <Kpi label="Days sales outstanding" value={<NotConnected />} />
      </div>
      <div className="grid">
        <Panel span={7} title="Revenue by department">
          <div className="tw"><table>
            <thead><tr><th>Sector</th><th className="n">Actual</th><th className="n">Target</th></tr></thead>
            <tbody>{sectors.map((s) => (
              <tr key={s.key}><td>{s.label}</td><td className="n num">{fmt(s.value / 1e6, 1)}</td><td className="n"><NotConnected /></td></tr>
            ))}</tbody>
          </table></div>
          <p className="note" style={{ marginTop: 8 }}>Figures in QAR M, January to {MONTHS[o.month]} {o.year}. No target source is connected.</p>
        </Panel>
        <Panel span={6} title="Al Manzil - revenue by year">
          <MonthBars label="Al Manzil revenue by year" months={MONTHS} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: r.revenue }))} />
        </Panel>
        <Panel span={6} title="Al Manzil - net profit / loss by year">
          <MonthBars label="Al Manzil net profit or loss" months={MONTHS} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: r.net }))} />
        </Panel>
        <Panel span={5} title="Receivables aging">
          <p className="empty">Not connected</p>
        </Panel>
        <Panel span={12} title="Overdue invoices">
          <div className="tw"><table>
            <thead><tr><th>Invoice</th><th>Account</th><th>Due</th><th className="n">Amount</th><th className="n">Balance</th><th>Status</th></tr></thead>
            <tbody><Empty cols={6} text="Not connected" /></tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
