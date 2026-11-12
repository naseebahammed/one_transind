import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { getSalesSectors } from "@/lib/sales-sectors";
import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview } from "@/lib/data";
import { fmt, MONTHS, money, sum } from "@/lib/format";
import { MonthBars } from "@/components/admin/FinanceCharts";
import { getCombinedReceivables } from "@/lib/receivables-rollup";
import { keyFor, report, years, loadReports } from "@/lib/reports";
import { listCompanies } from "@/lib/companies";
import { link } from "@/lib/url";
import { MonthSelect } from "@/components/MonthSelect";
import { YearSelect } from "@/components/YearSelect";
import { CompanySelect } from "@/components/CompanySelect";
import { listEffectiveDepartmentTargets } from "@/lib/sales-indicators";
import { departmentYtdTargets } from "@/lib/sales-targets";
import { Empty, HBars, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Finance · One Transind" };

type Params = Promise<{ company?: string; year?: string; m?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const [reports, o, sectors, { company, year, m }, allCompanies] = await Promise.all([
    loadReports(),
    getOverview(),
    getSalesSectors(true),
    searchParams,
    listCompanies(),
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
  const companies = allCompanies.filter((c) => c.active && !c.hidden && years(reports, keyFor(c)).length);
  // No (or unknown) choice means all companies.
  const selected = companies.find((c) => String(c.id) === company);
  const isAll = !selected;
  const name = isAll ? "All companies" : selected?.name ?? "Company";
  const key = isAll ? companies.map(keyFor) : selected ? keyFor(selected) : [];
  const allYears = years(reports, key);
  // "all" (or anything unknown) shows every year / every month.
  const pickedYear = allYears.includes(Number(year)) ? Number(year) : undefined;
  const pickedMonth = Number(m) >= 1 && Number(m) <= 12 ? Number(m) - 1 : undefined;
  const am = (pickedYear ? [pickedYear] : allYears).map((y) => [y, report(reports, y, key)] as const), COLORS = ["#5b7cff", "#3ee08f", "#ffbe55", "#c084fc"];
  // With no month picked, stop at the last month that has any figure (till date) instead of showing empty future months.
  const lastDataMonth = Math.max(0, ...am.flatMap(([, r]) => r.revenue.map((v, i) => (v || r.totalCost[i] ? i : 0))));
  const monthNames = pickedMonth === undefined ? MONTHS.slice(0, lastDataMonth + 1) : [MONTHS[pickedMonth]];
  const pick = (data: number[]) => (pickedMonth === undefined ? data.slice(0, lastDataMonth + 1) : [data[pickedMonth]]);

  const netProfit = sum(am.flatMap(([, r]) => pick(r.net)));

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <CompanySelect companies={companies} value={selected?.id ?? "all"} base={link("/finance", { year, m })} allLabel="All companies" />
        <YearSelect years={allYears} value={pickedYear ?? "all"} base={link("/finance", { company, m })} allLabel="All years" />
        <MonthSelect value={pickedMonth ?? "all"} max={11} names={MONTHS} year={pickedYear} base={link("/finance", { company, year })} allLabel="All months" />
        <Link href="/finance/pnl" className="btn primary" style={{ marginLeft: "auto", textDecoration: "none" }}>Monthly P&amp;L by company →</Link>
      </div>
      <div className="kpis">
        <Kpi label="Revenue year to date" value={`${fmt(rev / 1e6)} M`} up />
        <Kpi label="Gross margin" value={`${fmt(rev ? (1 - cost / rev) * 100 : 0, 1)}%`} />
        <Kpi label="Net profit / loss" value={`${fmt(netProfit / 1e6, 2)} M`} delta={name} up={netProfit >= 0} />
        <Kpi label="Receivables outstanding" value={ar ? money(ar.total) : <NotConnected />} up />
      </div>
      <div className="grid">
        <Panel span={6} title={`${name} - revenue by year`}>
          <MonthBars label={`${name} revenue by year`} months={monthNames} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: pick(r.revenue) }))} />
        </Panel>
        <Panel span={6} title={`${name} - net profit / loss by year`}>
          <MonthBars label={`${name} net profit or loss`} months={monthNames} series={am.map(([y, r], i) => ({ name: String(y), color: COLORS[i % 4], data: pick(r.net) }))} />
        </Panel>
        <Panel span={12} title={`${name} - P&L`} src={`QAR · ${monthNames[0]}${monthNames.length > 1 ? ` to ${monthNames.at(-1)}` : ""}`}>
          <div className="tw"><table>
            <thead><tr><th>Year</th><th className="n">Revenue</th><th className="n">Total cost</th><th className="n">Net profit / loss</th></tr></thead>
            <tbody>{am.map(([y, r]) => {
              const net = sum(pick(r.net));
              return (
                <tr key={y}>
                  <td>{y}</td>
                  <td className="n num">{fmt(sum(pick(r.revenue)))}</td>
                  <td className="n num">{fmt(sum(pick(r.totalCost)))}</td>
                  <td className={`n num${net < 0 ? " down" : ""}`}>{fmt(net)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <p className="note" style={{ marginTop: 8 }}><Link href="/finance/pnl">Monthly P&amp;L by company →</Link></p>
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
            Figures in QAR M, January to {MONTHS[o.month]} {o.year}.
          </p>
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
