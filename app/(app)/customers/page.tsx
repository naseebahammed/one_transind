import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCustomers } from "@/lib/data";
import { fmt, MONTHS, pct } from "@/lib/format";
import { BrandList, Kpi, MonthBars, Panel } from "@/components/ui";

export const metadata = { title: "Customers · One Transind" };

export default function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await connection();
  const [{ c: id }, d] = await Promise.all([searchParams, getCustomers()]);
  const c = d.customers.find((x) => x.id === id) ?? d.customers[0];
  if (!c) return <p className="empty">No customers.</p>;
  const label = `${MONTHS[d.month]} ${d.year}`, ch = pct(c.mtd, c.lm);
  const series = [Array.from({ length: 12 }, (_, i) => (i <= d.month ? c.months[i] ?? 0 : null))];

  return (
    <div className="split">
      <Panel title="Customers" src={`Top ${d.customers.length} / ${fmt(d.customerCount)} by YTD sales`}>
        <div className="list">
          {d.customers.map((x) => (
            <Link key={x.id} className="row" href={`/customers?c=${encodeURIComponent(x.id)}`} aria-current={x.id === c.id}>
              <span><b style={{ color: "var(--ink)" }}>{x.name}</b><br /><span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.id} · {x.cat}</span></span>
              <span className="num">{fmt(x.mtd)}</span>
            </Link>
          ))}
        </div>
      </Panel>
      <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
        <Panel title={c.name} src={<span className="chip plain"><span className="mono">{c.id}</span></span>}>
          <div className="kpis">
            <Kpi label={`Sales ${label}`} value={`${fmt(c.mtd)} QAR`} delta={`${ch >= 0 ? "▲" : "▼"} ${fmt(Math.abs(ch), 1)}% vs previous month`} up={ch >= 0} />
            <Kpi label="Year to date" value={`${fmt(c.ytd)} QAR`} />
            <Kpi label="Channel" value={c.cat || "—"} delta={c.group || undefined} up />
          </div>
        </Panel>
        <Panel title={`Brand sales · ${label}`}><BrandList brands={c.brands} /></Panel>
        <Panel title={`Monthly sales ${d.year}`} src="QAR"><MonthBars series={series} /></Panel>
        <Panel title="AR aging"><p className="empty">—</p></Panel>
        <Panel title="Invoices"><p className="empty">—</p></Panel>
        <Panel title="Opportunities"><p className="empty">—</p></Panel>
      </div>
    </div>
  );
}
