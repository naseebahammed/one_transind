import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCustomers } from "@/lib/data";
import { getOutstandingByCustomer, getReceivables } from "@/lib/receivables";
import { fmt, MONTHS, pct } from "@/lib/format";
import { OutstandingTable } from "@/components/OutstandingTable";
import { BrandList, Kpi, MonthBars, Panel } from "@/components/ui";

export const metadata = { title: "Customers · One Transind" };

export default function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await connection();
  await requireUser();
  const [{ c: id }, d] = await Promise.all([searchParams, getCustomers()]);
  const c = d.customers.find((x) => x.id === id) ?? d.customers[0];
  if (!c) return <p className="empty">No customers.</p>;
  const [ar, owing] = await Promise.all([getReceivables(c.id), getOutstandingByCustomer()]);
  const label = `${MONTHS[d.month]} ${d.year}`, ch = pct(c.mtd, c.lastMonth);
  const series = [Array.from({ length: 12 }, (_, i) => (i <= d.month ? c.months[i] ?? 0 : null))];

  return (
    <div className="split">
      <Panel title="Customers" src={`Top ${d.customers.length} / ${fmt(d.customerCount)} by YTD sales`}>
        <div className="list">
          {d.customers.map((x) => (
            <Link key={x.id} className="row" href={`/customers?c=${encodeURIComponent(x.id)}`} aria-current={x.id === c.id}>
              <span><b style={{ color: "var(--ink)" }}>{x.name}</b><br /><span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.id} · {x.category}</span></span>
              <span className="num">{fmt(x.mtd)}</span>
            </Link>
          ))}
        </div>
      </Panel>
      <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
        <Panel title={c.name} src={<span className="chip plain"><span className="mono">{c.id}</span></span>}>
          <div className="kpis">
            <Kpi label={`Sales ${label}`} value={fmt(c.mtd)} delta={`${ch >= 0 ? "▲" : "▼"} ${fmt(Math.abs(ch), 1)}% vs previous month`} up={ch >= 0} />
            <Kpi label="Year to date" value={fmt(c.ytd)} />
            <Kpi label="Channel" value={c.category || "—"} delta={c.group || undefined} up />
          </div>
        </Panel>
        <Panel title={`Brand sales · ${label}`}><BrandList brands={c.brands} /></Panel>
        <Panel title={`Monthly sales ${d.year}`} src="QAR"><MonthBars series={series} /></Panel>
        <Panel title="AR aging" src="QAR, days past due date">
          <div className="tw"><table>
            <thead><tr>{ar.aging.map((a) => <th key={a.bucket} className="n">{a.bucket}</th>)}<th className="n">Total</th></tr></thead>
            <tbody><tr>{ar.aging.map((a) => <td key={a.bucket} className="n num">{fmt(a.value)}</td>)}<td className="n num"><b>{fmt(ar.aging.reduce((t, a) => t + a.value, 0))}</b></td></tr></tbody>
          </table></div>
        </Panel>
        <Panel title="Outstanding by customer" src="QAR, top 50 by overdue amount">
          <OutstandingTable rows={owing} />
        </Panel>
        <Panel title="Ordered, not yet delivered" src="QAR, reservations without a delivery order">
          {ar.pending.length ? <div className="tw"><table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Salesman</th><th className="n">Amount</th></tr></thead>
            <tbody>{ar.pending.map((p) => <tr key={p.invoice}><td className="mono">{p.invoice}</td><td>{p.date}</td><td>{p.salesman ?? "—"}</td><td className="n num">{fmt(p.amount)}</td></tr>)}</tbody>
          </table></div> : <p className="empty">None pending.</p>}
        </Panel>
        <Panel title="Opportunities"><p className="empty">Not connected</p></Panel>
      </div>
    </div>
  );
}
