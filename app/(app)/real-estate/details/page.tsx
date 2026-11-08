import { SECTOR } from "@/lib/org";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, MONTHS, sum } from "@/lib/format";
import { link } from "@/lib/url";
import { AL_MANZIL_NAME, dailyYears, keyFor, occupancy, report, revenueLines, years, loadReports } from "@/lib/reports";
import { listCompanies } from "@/lib/companies";
import { CompareChart } from "@/components/charts";
import { CompanySelect } from "@/components/CompanySelect";
import { YearSelect } from "@/components/YearSelect";
import { HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Real Estate · One Transind" };
type Params = Promise<{ view?: string; company?: string; year?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection(); // the P&L and stay-report files can change when a statement is uploaded
  await loadReports();
  const { view, company, year } = await searchParams;
  const stay = view === "stay";
  const companies = (await listCompanies("", SECTOR.realEstate)).filter((c) => c.active && !c.hidden);
  const all = company === "all";
  const selected = all ? undefined : companies.find((c) => String(c.id) === company) ?? companies.find((c) => c.name.trim().toLowerCase() === AL_MANZIL_NAME) ?? companies[0];
  const companyParam = all ? "all" : selected && String(selected.id);
  const key = all ? companies.map(keyFor) : selected && keyFor(selected);
  const ys = key ? (stay ? dailyYears(key) : years(key)) : [];
  const pick = year && ys.includes(+year) ? +year : 2026;
  const idx = ys.includes(pick) ? ys.indexOf(pick) : ys.length - 1;
  const toolbar = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div className="tabs">
        <Link href="/real-estate/overview" aria-pressed={false}>Overview</Link>
        <Link href="/real-estate/details" aria-pressed>Details</Link>
      </div>
      {!!companies.length && <CompanySelect companies={companies} value={all ? "all" : selected?.id} allLabel="All" base={link("/real-estate/details", { view: stay ? "stay" : undefined })} />}
      {!!ys.length && <YearSelect years={ys} value={ys[idx]} base={link("/real-estate/details", { view: stay ? "stay" : undefined, company: companyParam })} />}
      <div className="tabs">
        <Link href={link("/real-estate/details", { company: companyParam, year })} aria-pressed={!stay}>P&amp;L</Link>
        <Link href={link("/real-estate/details", { view: "stay", company: companyParam, year })} aria-pressed={stay}>Stay report</Link>
      </div>
    </div>
  );
  if (!ys.length) return <>{toolbar}<p className="empty">No P&amp;L or stay-report data uploaded for {all ? "any company" : selected?.name ?? "this company"} yet.</p></>;
  const cur = ys[idx], prev = idx > 0 ? ys[idx - 1] : undefined;
  const R = ys.map((y) => report(y, key!)), c = R[idx], p = idx > 0 ? R[idx - 1] : undefined;
  const O = ys.map((y) => occupancy(y, key!)), oc = O[idx];
  const avg = (o: typeof oc) => ({ occ: sum(o.map((m) => m.sold)) / (sum(o.map((m) => m.avail)) || 1), adr: sum(o.map((m) => m.room)) / (sum(o.map((m) => m.sold)) || 1) });
  const revpar = (o: typeof oc) => sum(o.map((m) => m.room)) / (sum(o.map((m) => m.avail)) || 1);
  const rev = sum(c.revenue), cost = sum(c.totalCost), net = sum(c.net);
  // Cost and net need every company with a P&L that year to have costs: with none, "net" would just repeat revenue.
  const costedIn = (y: number) => {
    const activeKeys = [key!].flat().filter((k) => years(k).includes(y));
    return activeKeys.length > 0 && activeKeys.every((k) => sum(report(y, k).totalCost) !== 0);
  };
  const costed = costedIn(cur);
  // Compare against the same months last year: the current year is usually only partly loaded.
  const upto = Math.max(1, ...c.revenue.map((v, i) => (v ? i + 1 : 0)));
  const ytd = (a: number[]) => sum(a.slice(0, upto));
  const delta = (a: number, b?: number) => (b ? `${a >= b ? "+" : ""}${fmt(((a - b) / Math.abs(b)) * 100, 1)}% vs ${upto < 12 ? `${MONTHS[0]}–${MONTHS[upto - 1]} ` : ""}${prev}` : undefined);
  return (
    <>
      {toolbar}
      {stay ? (
        <>
          <div className="kpis">
            <Kpi label={`Occupancy ${cur}`} value={`${fmt(avg(oc).occ * 100, 1)}%`} delta={prev ? `${fmt(avg(O[idx - 1]).occ * 100, 1)}% in ${prev}` : undefined} />
            <Kpi label={`Average daily rate ${cur}`} value={fmt(avg(oc).adr, 0)} delta={prev ? `${fmt(avg(O[idx - 1]).adr, 0)} in ${prev}` : undefined} />
            <Kpi label={`RevPAR ${cur}`} value={fmt(revpar(oc), 0)} delta={prev ? `${fmt(revpar(O[idx - 1]), 0)} in ${prev}` : undefined} />
          </div>
          <div className="grid">
            <Panel span={12} title="Occupancy and average daily rate by month">
              <div className="tw"><table>
                <thead><tr><th>Month</th>{ys.map((y) => <th key={y} className="n" colSpan={4}>{y}</th>)}</tr>
                  <tr><th />{ys.flatMap((y) => ["Occupancy", "ADR", "Rooms sold", "Long stay"].map((h) => <th key={y + h} className="n">{h}</th>))}</tr></thead>
                <tbody>{MONTHS.map((m, i) => (
                  <tr key={m}><td>{m}</td>{O.flatMap((o, j) => [<td key={`${j}o`} className="n num">{o[i].days ? `${fmt(o[i].occ * 100, 1)}%` : "-"}</td>, <td key={`${j}a`} className="n num">{o[i].days ? fmt(o[i].adr) : "-"}</td>, <td key={`${j}s`} className="n num">{o[i].days ? fmt(o[i].sold) : "-"}</td>, <td key={`${j}l`} className="n num">{o[i].days ? `${fmt(o[i].longShare * 100, 1)}%` : "-"}</td>])}</tr>
                ))}</tbody>
              </table></div>
              <p className="note" style={{ marginTop: 8 }}>ADR = room revenue / rooms sold. RevPAR = room revenue / rooms available. Long stay = share of guests on long-stay rates. From Oct 2025 the report adds "other revenue" (space rental) on top of room revenue.</p>
            </Panel>
          </div>
        </>
      ) : (
        <>
          <div className="kpis">
            <Kpi label={`Revenue ${cur}`} value={`${fmt(rev / 1e6, 2)} M`} delta={delta(rev, p && ytd(p.revenue))} spark={c.revenue.map((v) => v / 1e6)} up={!p || rev >= ytd(p.revenue)} />
            {costed ? <>
              <Kpi label={`Total cost ${cur}`} value={`${fmt(cost / 1e6, 2)} M`} delta={delta(cost, p && ytd(p.totalCost))} spark={c.totalCost.map((v) => v / 1e6)} up={!p || cost <= ytd(p.totalCost)} />
              <Kpi label={`Net profit ${cur}`} value={`${fmt(net / 1e6, 2)} M`} delta={delta(net, p && ytd(p.net))} spark={c.net.map((v) => v / 1e6)} up={!p || net >= ytd(p.net)} />
              <Kpi label="Net margin" value={`${fmt(rev ? (net / rev) * 100 : 0, 1)}%`} />
            </> : <Kpi label="Cost, net profit and margin" value="–" delta="Not every company in view has cost data this year" />}
          </div>
          <div className="grid">
            <Panel span={12} title="Revenue by month">
              <CompareChart years={ys} series={R.map((r) => r.revenue.map((v) => v / 1e6))} sel={upto - 1} />
            </Panel>
            {costed && <Panel span={12} title="Net profit / loss by month">
              <CompareChart years={ys} series={R.map((r) => r.net.map((v) => v / 1e6))} sel={upto - 1} />
            </Panel>}
            <Panel span={6} title={`Revenue by source - ${cur}`}>
              <HBars rows={revenueLines(cur, key!).map(([l, v]) => ({ l, v: v / 1e6 }))} unit=" M" />
            </Panel>
            {costed && <Panel span={6} title={`Cost breakdown - ${cur}`}>
              <HBars rows={c.costGroups.map(([l, d]) => ({ l, v: sum(d) / 1e6 })).sort((a, b) => b.v - a.v)} unit=" M" />
            </Panel>}
            {ys.map((y, i) => { const v = sum(R[i].revenue), tc = sum(R[i].totalCost), n = sum(R[i].net); return (
              <Panel key={y} span={ys.length <= 2 ? 6 : 4} title={`Year by year - ${y}`} src={`Full detail and upload: Admin › Company finance${selected ? ` (${selected.name})` : ""}`}>
                <div className="tw"><table>
                  <tbody>
                    <tr><td>Revenue</td><td className="n num">{fmt(v)}</td></tr>
                    {costedIn(y) ? <>
                      <tr><td>Total cost</td><td className="n num">{fmt(tc)}</td></tr>
                      <tr><td>Net</td><td className="n num">{fmt(n)}</td></tr>
                      <tr><td>Margin</td><td className="n num">{fmt(v ? (n / v) * 100 : 0, 1)}%</td></tr>
                    </> : <tr><td>Cost and net</td><td className="n">–</td></tr>}
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
