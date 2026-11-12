import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { getSalesSectors } from "@/lib/sales-sectors";
import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview } from "@/lib/data";
import { fmt, MONTHS, money, sum } from "@/lib/format";
import { MonthBars } from "@/components/admin/FinanceCharts";
import { getCombinedReceivables } from "@/lib/receivables-rollup";
import { alManzilKey, report, years, loadReports } from "@/lib/reports";
import { listEffectiveDepartmentTargets } from "@/lib/sales-indicators";
import { departmentYtdTargets } from "@/lib/sales-targets";
import { Empty, HBars, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Finance · One Transind" };

export default function Page() {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content /></Suspense>;
}

async function Content() {
  await connection();
  await requireUser();
  const [reports, o, sectors] = await Promise.all([
    loadReports(),
    getOverview(),
    getSalesSectors(true),
  ]);
  const rev = sum(sectors.map((s) => s.value)), cost = sum(sectors.map((s) => s.cost));
  const [ar, deptTargets] = await Promise.all([
    getCombinedReceivables({
      ytdErpSales: rev,
      year: o.year,
      month: o.month,
      day: o.day,
      overdueLimit: 25,
    }),
    listEffectiveDepartmentTargets(o.year),
  ]);
  const ytdTargets = departmentYtdTargets(deptTargets, o.year, o.month);
  const alManzil = alManzilKey(reports), am = years(reports, alManzil).map((y) => [y, report(reports, y, alManzil)] as const), COLORS = ["#5b7cff", "#3ee08f", "#ffbe55", "#c084fc"];

  return (
    <>
      <p style={{ marginBottom: 10 }}><Link href="/finance/pnl">Monthly P&amp;L by company →</Link></p>
      <div className="kpis">
        <Kpi label="Revenue year to date" value={`${fmt(rev / 1e6)} M`} up />
        <Kpi label="Gross margin" value={`${fmt(rev ? (1 - cost / rev) * 100 : 0, 1)}%`} />
        <Kpi label="Receivables outstanding" value={ar ? money(ar.total) : <NotConnected />} delta={ar ? ar.sourceLabel : undefined} up />
        <Kpi label="Days sales outstanding" value={ar && ar.dsoDays !== null ? `${fmt(ar.dsoDays, 1)} d` : <NotConnected />} delta={ar && ar.dsoDays !== null ? ar.sourceLabel : undefined} />
      </div>
      <div className="grid">
        <Panel span={7} title="Revenue by department">
          <div className="tw"><table>
            <thead><tr><th>Sector</th><th className="n">Actual</th><th className="n">Target</th></tr></thead>
            <tbody>{sectors.map((s) => {
              const target = ytdTargets.get(s.key);
              return (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td className="n num">{fmt(s.value / 1e6, 1)}</td>
                  <td className={`n${target !== undefined ? " num" : ""}`}>{target !== undefined ? fmt(target / 1e6, 1) : <NotConnected />}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <p className="note" style={{ marginTop: 8 }}>
            Figures in QAR M, January to {MONTHS[o.month]} {o.year}.{ytdTargets.size === 0 ? " No target source is connected." : ""}
          </p>
        </Panel>
        <Panel span={6} title="Al Manzil - revenue by year">
          <MonthBars label="Al Manzil revenue by year" months={MONTHS} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: r.revenue }))} />
        </Panel>
        <Panel span={6} title="Al Manzil - net profit / loss by year">
          <MonthBars label="Al Manzil net profit or loss" months={MONTHS} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: r.net }))} />
        </Panel>
        <Panel span={5} title="Receivables aging" src={ar ? `${ar.sourceLabel} · As of ${ar.latestAsOf}` : undefined}>
          {ar ? (
            <HBars
              rows={[
                { l: "Not due", v: ar.notDue },
                { l: "1–30 days", v: ar.days1To30 },
                { l: "31–60 days", v: ar.days31To60 },
                { l: "61–90 days", v: ar.days61To90 },
                { l: "Over 90 days", v: ar.over90 },
              ]}
              unit=" QAR"
            />
          ) : (
            <p className="empty">Not connected</p>
          )}
        </Panel>
        <Panel span={12} title="Overdue invoices" src={ar?.overdueInvoices.length ? `${ar.sourceLabel} · QAR` : undefined}>
          <div className="tw"><table>
            <thead><tr><th>Invoice</th><th>Account</th><th>Due</th><th className="n">Amount</th><th className="n">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {ar?.overdueInvoices.length ? ar.overdueInvoices.map((inv) => {
                const isSevere = inv.status === "Overdue" || inv.status === "Legal" || inv.status === "Over 90d";
                return (
                  <tr key={inv.key}>
                    <td className="mono">{inv.invoiceNo}</td>
                    <td>
                      {inv.accountName}
                      {ar.subsidiaryCount > 0 && inv.companyName ? (
                        <small style={{ display: "block", color: "var(--muted)" }}>{inv.companyName}</small>
                      ) : null}
                    </td>
                    <td className="mono">{inv.dueDate}</td>
                    <td className="n num">{fmt(inv.amount)}</td>
                    <td className="n num">{fmt(inv.balance)}</td>
                    <td><span className={`chip ${isSevere ? "bad" : "warn"}`}>{inv.status}</span></td>
                  </tr>
                );
              }) : <Empty cols={6} text="Not connected" />}
            </tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
