import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt } from "@/lib/format";
import { link } from "@/lib/url";
import { keyFor, MONTHS, occupancy, report, revenueLines, sum, years } from "@/lib/al-manzil";
import { listCompanies } from "@/lib/companies";
import { CompareChart } from "@/components/charts";
import { CompanySelect } from "@/components/CompanySelect";
import { HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Real Estate · One Transind" };
type Params = Promise<{ view?: string; company?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection(); // the P&L and stay-report files can change when a statement is uploaded
  const { view, company } = await searchParams;
  const stay = view === "stay";
  const companies = await listCompanies("", "re");
  const selected = companies.find((c) => String(c.id) === company) ?? companies.find((c) => c.name.trim().toLowerCase() === "al manzil") ?? companies[0];
  const companyParam = selected && String(selected.id);
  const toolbar = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {!!companies.length && <CompanySelect companies={companies} value={selected?.id} base={link("/real-estate", { view: stay ? "stay" : undefined })} />}
      <div className="tabs">
        <Link href={link("/real-estate", { company: companyParam })} aria-pressed={!stay}>P&amp;L</Link>
        <Link href={link("/real-estate", { view: "stay", company: companyParam })} aria-pressed={stay}>Stay report</Link>
      </div>
    </div>
  );
  const key = selected && keyFor(selected);
  const ys = key ? years(key) : [];
  if (!ys.length) return <>{toolbar}<p className="empty">No P&amp;L or stay-report data uploaded for {selected?.name ?? "this company"} yet.</p></>;
  const cur = ys.at(-1)!, prev = ys.at(-2);
  const R = ys.map((y) => report(y, key)), c = R.at(-1)!, p = prev ? R.at(-2)! : undefined;
  const O = ys.map((y) => occupancy(y, key)), oc = O.at(-1)!;
  const avg = (o: typeof oc) => ({ occ: sum(o.map((m) => m.occ * m.days)) / (sum(o.map((m) => m.days)) || 1), adr: sum(o.map((m) => m.room)) / (sum(o.map((m) => m.sold)) || 1) });
  const rev = sum(c.revenue), cost = sum(c.totalCost), net = sum(c.net);
  const delta = (a: number, b?: number) => (b ? `${a >= b ? "+" : ""}${fmt(((a - b) / Math.abs(b)) * 100, 1)}% vs ${prev}` : undefined);
  return (
    <>
      {toolbar}
      {stay ? (
        <>
          <div className="kpis">
            <Kpi label={`Occupancy ${cur}`} value={`${fmt(avg(oc).occ * 100, 1)}%`} delta={prev ? `${fmt(avg(O.at(-2)!).occ * 100, 1)}% in ${prev}` : undefined} />
            <Kpi label={`Average daily rate ${cur}`} value={`${fmt(avg(oc).adr, 0)} QAR`} delta={prev ? `${fmt(avg(O.at(-2)!).adr, 0)} in ${prev}` : undefined} />
          </div>
          <div className="grid">
            <Panel span={12} title="Occupancy and average daily rate by month">
              <div className="tw"><table>
                <thead><tr><th>Month</th>{ys.map((y) => <th key={y} className="n" colSpan={3}>{y}</th>)}</tr>
                  <tr><th />{ys.flatMap((y) => ["Occupancy", "ADR", "Rooms sold"].map((h) => <th key={y + h} className="n">{h}</th>))}</tr></thead>
                <tbody>{MONTHS.map((m, i) => (
                  <tr key={m}><td>{m}</td>{O.flatMap((o, j) => [<td key={`${j}o`} className="n num">{o[i].days ? `${fmt(o[i].occ * 100, 1)}%` : "-"}</td>, <td key={`${j}a`} className="n num">{o[i].days ? fmt(o[i].adr) : "-"}</td>, <td key={`${j}s`} className="n num">{o[i].days ? fmt(o[i].sold) : "-"}</td>])}</tr>
                ))}</tbody>
              </table></div>
              <p className="note" style={{ marginTop: 8 }}>ADR = room revenue / rooms sold. From Oct 2025 the report adds "other revenue" (space rental) on top of room revenue.</p>
            </Panel>
          </div>
        </>
      ) : (
        <>
          <div className="kpis">
            <Kpi label={`Revenue ${cur}`} value={`${fmt(rev / 1e6, 2)} M`} delta={delta(rev, p && sum(p.revenue))} spark={c.revenue.map((v) => v / 1e6)} up />
            <Kpi label={`Total cost ${cur}`} value={`${fmt(cost / 1e6, 2)} M`} delta={delta(cost, p && sum(p.totalCost))} spark={c.totalCost.map((v) => v / 1e6)} />
            <Kpi label={`Net profit ${cur}`} value={`${fmt(net / 1e6, 2)} M`} delta={delta(net, p && sum(p.net))} spark={c.net.map((v) => v / 1e6)} up={net >= 0} />
            <Kpi label="Net margin" value={`${fmt(rev ? (net / rev) * 100 : 0, 1)}%`} />
          </div>
          <div className="grid">
            <Panel span={12} title="Revenue by month (QAR M)">
              <CompareChart years={ys} series={R.map((r) => r.revenue.map((v) => v / 1e6))} sel={-1} />
            </Panel>
            <Panel span={12} title="Net profit / loss by month (QAR M)">
              <CompareChart years={ys} series={R.map((r) => r.net.map((v) => v / 1e6))} sel={-1} />
            </Panel>
            <Panel span={6} title={`Revenue by source - ${cur} (QAR M)`}>
              <HBars rows={revenueLines(cur, key).map(([l, v]) => ({ l, v: v / 1e6 }))} unit=" M" />
            </Panel>
            <Panel span={6} title={`Cost breakdown - ${cur} (QAR M)`}>
              <HBars rows={c.costGroups.map(([l, d]) => ({ l, v: sum(d) / 1e6 })).sort((a, b) => b.v - a.v)} unit=" M" />
            </Panel>
            {ys.map((y, i) => { const v = sum(R[i].revenue), tc = sum(R[i].totalCost), n = sum(R[i].net); return (
              <Panel key={y} span={ys.length <= 2 ? 6 : 4} title={`Year by year - ${y}`} src={`Full detail and upload: Admin › Company finance${companyParam ? ` (${selected!.name})` : ""}`}>
                <div className="tw"><table>
                  <tbody>
                    <tr><td>Revenue</td><td className="n num">{fmt(v)}</td></tr>
                    <tr><td>Total cost</td><td className="n num">{fmt(tc)}</td></tr>
                    <tr><td>Net</td><td className="n num">{fmt(n)}</td></tr>
                    <tr><td>Margin</td><td className="n num">{fmt(v ? (n / v) * 100 : 0, 1)}%</td></tr>
                  </tbody>
                </table></div>
              </Panel>
            ); })}
          </div>
        </>
      )}
    </>
  );
}
