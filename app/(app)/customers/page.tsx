import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCustomers } from "@/lib/data";
import { link } from "@/lib/url";
import { getOutstandingByCustomer, getReceivables } from "@/lib/receivables";
import { fmt, MONTHS, pct } from "@/lib/format";
import { OutstandingTable } from "@/components/OutstandingTable";
import { MonthSelect } from "@/components/MonthSelect";
import { CompanySelect } from "@/components/CompanySelect";
import { YearSelect } from "@/components/YearSelect";
import { BrandList, Kpi, MonthBars, Panel } from "@/components/ui";

export const metadata = { title: "Customers · One Transind" };

export default function Page({ searchParams }: { searchParams: Promise<{ c?: string; all?: string; pending?: string; m?: string; year?: string; g?: string }> }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Promise<{ c?: string; all?: string; pending?: string; m?: string; year?: string; g?: string }> }) {
  await connection();
  await requireUser();
  const { c: id, all, pending, m, year: rawYear, g } = await searchParams;
  const pickMonth = Number(m), pickYear = Number(rawYear);
  const d = await getCustomers(Number.isInteger(pickYear) && pickYear > 0 ? pickYear : undefined, Number.isInteger(pickMonth) && pickMonth >= 1 && pickMonth <= 12 ? pickMonth - 1 : undefined);
  // Keep the chosen month and year in every link on this page.
  const href = (params: Record<string, string | undefined>) => link("/customers", { m, year: rawYear, g, ...params });
  const years = [d.latest.year - 2, d.latest.year - 1, d.latest.year];
  // Groups come from the customers loaded here (top 60 by YTD sales).
  const groups = [...new Set(d.customers.map((x) => x.group).filter(Boolean))].sort();
  const group = groups.includes(g ?? "") ? g : undefined;
  const list = group ? d.customers.filter((x) => x.group === group) : d.customers;
  const c = list.find((x) => x.id === id) ?? list[0];
  if (!c) return <p className="empty">No customers.</p>;
  const [ar, owing] = await Promise.all([
    getReceivables(c.id),
    getOutstandingByCustomer(50, group),
  ]);
  const label = `${MONTHS[d.month]} ${d.year}`, ch = pct(c.mtd, c.lastMonth);
  const series = [Array.from({ length: 12 }, (_, i) => (i <= d.month ? c.months[i] ?? 0 : null))];

  return (
    <div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <MonthSelect value={d.month} max={d.year === d.latest.year ? d.latest.month : 11} names={MONTHS} year={d.year} base={link("/customers", { year: String(d.year), c: id, all, g: group })} />
      <YearSelect years={years} value={d.year} base={link("/customers", { m: String(d.month + 1), c: id, all, g: group })} />
      <CompanySelect label="Customer group" param="g" companies={groups.map((x) => ({ id: x, name: x }))} value={group ?? "all"} allLabel="All groups" base={link("/customers", { m: String(d.month + 1), year: String(d.year) })} />
    </div>
    <div className="split" style={{ alignItems: "start" }}>
      <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
      <Panel title="Customers" src={`Top ${list.length} / ${fmt(d.customerCount)} by YTD sales`}>
        <div className="list">
          {(all ? list : list.slice(0, 10)).map((x) => (
            <Link key={x.id} className="row" href={href({ c: x.id, all })} aria-current={x.id === c.id}>
              <span><b style={{ color: "var(--ink)" }}>{x.name}</b><br /><span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.id} · {x.category}</span></span>
              <span className="num">{fmt(x.mtd)}</span>
            </Link>
          ))}
        </div>
        {!all && list.length > 10 && <Link className="btn sm" href={href({ c: c.id, all: "1" })} style={{ marginTop: 10, display: "inline-block" }}>Show all ({fmt(list.length)})</Link>}
      </Panel>
      <Panel title="Outstanding by customer" src={`QAR, top 50 by overdue amount${group ? ` · ${group}` : ""}`}>
        <OutstandingTable rows={owing} />
      </Panel>
      </div>
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
        <Panel title="Ordered, not yet delivered" src="QAR, reservations without a delivery order">
          {ar.pending.length ? <div className="tw"><table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Salesman</th><th className="n">Amount</th></tr></thead>
            <tbody>{(pending ? ar.pending : ar.pending.slice(0, 10)).map((p) => <tr key={p.invoice}><td className="mono">{p.invoice}</td><td>{p.date}</td><td>{p.salesman ?? "—"}</td><td className="n num">{fmt(p.amount)}</td></tr>)}</tbody>
          </table></div> : <p className="empty">None pending.</p>}
          {!pending && ar.pending.length > 10 && <Link className="btn sm" href={href({ c: c.id, all, pending: "1" })} style={{ marginTop: 10, display: "inline-block" }}>Show all ({fmt(ar.pending.length)})</Link>}
        </Panel>
      </div>
    </div>
    </div>
  );
}
