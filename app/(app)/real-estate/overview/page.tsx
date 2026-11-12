import { requireUser } from "@/lib/guard";
import { SECTOR } from "@/lib/org";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, MONTHS, sum } from "@/lib/format";
import { link } from "@/lib/url";
import { keyFor, report, years, loadReports } from "@/lib/reports";
import { listCompanies } from "@/lib/companies";
import { listPropertyTypes } from "@/lib/property-types";
import { YearSelect } from "@/components/YearSelect";
import { Panel } from "@/components/ui";
import { TenancyPanels } from "@/components/TenancyPanels";

export const metadata = { title: "Real Estate overview · One Transind" };
type Params = Promise<{ year?: string }>;

// One colour per cost group, cycled when there are more groups than colours.
const SEG = ["var(--brand)", "var(--cyan)", "var(--warn)", "var(--good)", "var(--accent)", "var(--series-2)"];
const pct = (v: number, max: number) => `${Math.min(100, Math.max(0, max ? (v / max) * 100 : 0))}%`;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

/** Change vs the previous year as a pill; `costLike` flips the colour so a rise reads as bad. */
function Change({ cur, prev, vs, costLike }: { cur: number; prev: number; vs: string; costLike?: boolean }) {
  if (!prev) return null;
  const c = ((cur - prev) / Math.abs(prev)) * 100;
  const good = costLike ? c <= 0 : c >= 0;
  return <span className={`dp num ${good ? "up" : "down"}`}>{c >= 0 ? "▲" : "▼"} {fmt(Math.abs(c), 1)}% vs {vs}</span>;
}

const Card = ({ label, value, neg, hl, children }: { label: string; value: string; neg?: boolean; hl?: boolean; children?: ReactNode }) => (
  <div className={`kpi${hl ? " hl" : ""}`}>
    <span className="l">{label}</span>
    <span className={`v num${neg ? " down" : ""}`}>{value}</span>
    {children}
  </div>
);

async function Content({ searchParams }: { searchParams: Params }) {
  await connection(); // the P&L files can change when a statement is uploaded
  await requireUser();
  const [reports, { year }, companies, types] = await Promise.all([loadReports(), searchParams, listCompanies("", SECTOR.realEstate), listPropertyTypes()]);
  const withData = companies.filter((c) => c.active && !c.hidden && years(reports, keyFor(c)).length);
  const ys = [...new Set(withData.flatMap((c) => years(reports, keyFor(c))))].sort();
  const tabs = (
    <nav className="tabs seg" aria-label="Real estate views">
      <Link href="/real-estate/overview" aria-pressed>Overview</Link>
      <Link href="/real-estate/details" aria-pressed={false}>Details</Link>
    </nav>
  );
  if (!ys.length) return <div className="reo"><div className="reo-bar">{tabs}</div><p className="empty">No P&amp;L data uploaded for any real-estate company yet.</p></div>;
  const cur = year && ys.includes(+year) ? +year : ys[ys.length - 1];
  const names = new Map(types);
  const prevYear = cur - 1;
  // Per company: a company missing this year's P&L, or uploading revenue only, must not skew totals, margins or the year-on-year change.
  const per = withData.filter((c) => years(reports, keyFor(c)).includes(cur)).map((c) => ({ c, r: report(reports, cur, keyFor(c)), p: report(reports, prevYear, keyFor(c)) }))
    .map((x) => ({ ...x, costed: sum(x.r.totalCost) !== 0 }));
  const missing = withData.filter((c) => !per.some((x) => x.c === c)).map((c) => c.name);
  const revenueOnly = per.filter((x) => !x.costed).map((x) => x.c.name);
  // Cost, net and margin need every property's costs: a partial total would read as the whole portfolio's result.
  const complete = !missing.length && !revenueOnly.length;
  // Compare against the same months last year: the current year is usually only partly loaded.
  const upto = Math.max(1, ...per.flatMap((x) => x.r.revenue.map((v, i) => (v ? i + 1 : 0))));
  const ytd = (a: number[]) => sum(a.slice(0, upto));
  const vsLabel = upto < 12 ? `${MONTHS[0]}–${MONTHS[upto - 1]} ${prevYear}` : String(prevYear);
  const groups = new Map<string, typeof per>();
  for (const x of per) groups.set(x.c.property_type, [...(groups.get(x.c.property_type) ?? []), x]);
  const rows = [...groups].map(([t, xs]) => {
    const cx = xs.filter((x) => x.costed);
    const revenue = sum(xs.map((x) => sum(x.r.revenue))), cRevenue = sum(cx.map((x) => sum(x.r.revenue))), cost = sum(cx.map((x) => sum(x.r.totalCost))), net = cRevenue - cost;
    const costGroups = new Map<string, number>();
    for (const x of cx) for (const [l, d] of x.r.costGroups) costGroups.set(l, (costGroups.get(l) ?? 0) + sum(d));
    return { name: names.get(t) ?? "Unassigned", n: xs.length, costed: cx.length, complete: cx.length === xs.length, revenue, cost, net, margin: cRevenue ? (net / cRevenue) * 100 : 0, costGroups: [...costGroups] };
  }).sort((a, b) => b.revenue - a.revenue);
  const costedPer = per.filter((x) => x.costed);
  const revenue = sum(rows.map((r) => r.revenue)), cost = sum(rows.map((r) => r.cost)), cRevenue = sum(costedPer.map((x) => sum(x.r.revenue))), net = cRevenue - cost;
  const margin = cRevenue ? (net / cRevenue) * 100 : 0;
  const prevRevenue = sum(per.map((x) => ytd(x.p.revenue)));
  const prevCost = sum(costedPer.map((x) => ytd(x.p.totalCost))), prevNet = sum(costedPer.map((x) => ytd(x.p.net)));
  // Biggest cost groups get their own colour; the rest fold into "Other" so legend colours never repeat.
  const lineTotals = new Map<string, number>();
  for (const r of rows) for (const [l, v] of r.costGroups) lineTotals.set(l, (lineTotals.get(l) ?? 0) + v);
  const top = [...lineTotals].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, lineTotals.size > SEG.length ? SEG.length - 1 : SEG.length);
  const costLines = lineTotals.size > top.length ? [...new Set([...top, "Other"])] : top;
  const lineOf = (l: string) => (top.includes(l) ? l : "Other");
  const barMax = Math.max(1, ...rows.flatMap((r) => [r.revenue, r.cost]));
  const base = "/real-estate/overview";
  return (
    <div className="reo">
      <div className="reo-bar">
        {tabs}
        <YearSelect years={ys} value={cur} base={link(base, {})} />
      </div>
      <div className="kpis">
        <Card label={`Revenue ${cur}`} value={`${fmt(revenue / 1e6, 2)} M`} neg={revenue < 0}>
          <Change cur={revenue} prev={prevRevenue} vs={vsLabel} />
        </Card>
        <Card label={`Total cost ${cur}`} value={complete ? `${fmt(cost / 1e6, 2)} M` : "–"}>
          {complete && <Change cur={cost} prev={prevCost} vs={vsLabel} costLike />}
        </Card>
        <Card label={`Net profit ${cur}`} value={complete ? `${fmt(net / 1e6, 2)} M` : "–"} neg={complete && net < 0} hl>
          {complete && <Change cur={net} prev={prevNet} vs={vsLabel} />}
        </Card>
        <div className="kpi ring">
          <svg viewBox="0 0 36 36" role="img" aria-label={complete ? `Net margin ${fmt(margin, 1)} percent` : "Net margin not available"}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--panel-2)" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={margin < 0 ? "var(--bad)" : "var(--good)"} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${complete ? Math.min(100, Math.abs(margin)) : 0} 100`} pathLength={100} transform="rotate(-90 18 18)" />
          </svg>
          <div><span className="l">Net margin</span><span className={`v num${complete && margin < 0 ? " down" : ""}`}>{complete ? `${fmt(margin, 1)}%` : "–"}</span></div>
        </div>
      </div>
      {(missing.length > 0 || revenueOnly.length > 0) && (
        <p className="note">
          {missing.length > 0 && <>No {cur} P&amp;L uploaded, left out of every figure: {missing.join(", ")}. </>}
          {revenueOnly.length > 0 && <>Revenue only, no cost lines: {revenueOnly.join(", ")}. </>}
          Cost, net profit and margin show only when every property has costs for the year.
        </p>
      )}
      <div className="grid">
        <Panel span={7} title="Revenue vs cost by property type"
          src={<span className="legend"><span><i className="sw rev" />Revenue</span><span><i className="sw cst" />Cost</span><span>· QAR M</span></span>}>
          <div className="pairs">{rows.map((r) => (
            <div className="pair" key={r.name}>
              <div className="nm"><span>{r.name}</span><small className="num">{fmt(r.revenue / 1e6, 2)} / {r.complete ? fmt(r.cost / 1e6, 2) : "cost data incomplete"}</small></div>
              <div className="t" title={`Revenue ${fmt(r.revenue)} QAR`}><b className="rev" style={{ width: pct(r.revenue, barMax) }} /></div>
              <div className="t" title={`Cost ${fmt(r.cost)} QAR`}><b className="cst" style={{ width: pct(r.complete ? r.cost : 0, barMax) }} /></div>
            </div>
          ))}</div>
        </Panel>
        <Panel span={5} title="Where the cost goes" src="share of total">
          <div className="shares">{rows.map((r) => {
            const total = sum(r.costGroups.map(([, v]) => Math.max(0, v)));
            const parts = costLines.map((l, i) => ({ l, c: SEG[i % SEG.length], v: Math.max(0, sum(r.costGroups.filter(([k]) => lineOf(k) === l).map(([, v]) => v))) })).filter((p) => p.v);
            const label = parts.map((p) => `${p.l} ${fmt((p.v / total) * 100, 0)}%`).join(", ");
            return (
              <div className="share" key={r.name}>
                <span>{r.name}</span>
                {!r.complete ? <small className="note">Cost data incomplete</small> : <div className="stack" role="img" aria-label={`${r.name}: ${label || "no cost"}`}>
                  {parts.map((p) => <b key={p.l} title={`${p.l}: ${fmt(p.v)} QAR (${fmt((p.v / total) * 100, 1)}%)`} style={{ width: pct(p.v, total), background: p.c }} />)}
                </div>}
              </div>
            );
          })}</div>
          {rows.some((r) => r.complete) && <div className="legend">{costLines.map((l, i) => <span key={l}><i className="sw" style={{ background: SEG[i % SEG.length] }} />{l}</span>)}</div>}
        </Panel>
        <Panel span={12} title="Comparison" src={`QAR · ${cur}`}>
          <div className="tw"><table className="cmp">
            <thead><tr><th>Property type</th><th className="n">Companies</th><th className="n">Revenue</th><th className="n">Total cost</th><th className="n">Net</th><th className="n">Margin</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.name} className={i === 0 ? "hl" : undefined}>
                <td>{r.name}</td><td className="n num">{r.costed < r.n ? `${r.n} (${r.costed} with costs)` : r.n}</td><td className="n num">{fmt(r.revenue)}</td>
                {r.complete ? <>
                  <td className="n num">{fmt(r.cost)}</td>
                  <td className={`n num${r.net < 0 ? " down" : ""}`}>{fmt(r.net)}</td>
                  <td className="n"><span className={`mg num${r.margin < 0 ? " down" : ""}`}>{fmt(r.margin, 1)}% <i aria-hidden="true"><b style={{ width: pct(Math.abs(r.margin), 100) }} /></i></span></td>
                </> : <td className="n" colSpan={3}>Cost data incomplete</td>}
              </tr>
            ))}</tbody>
            <tfoot><tr>
              <td>Total</td><td className="n num">{per.length}</td><td className="n num">{fmt(revenue)}</td>
              {complete ? <>
                <td className="n num">{fmt(cost)}</td>
                <td className={`n num${net < 0 ? " down" : ""}`}>{fmt(net)}</td><td className={`n num${margin < 0 ? " down" : ""}`}>{fmt(margin, 1)}%</td>
              </> : <td className="n" colSpan={3}>Cost data incomplete</td>}
            </tr></tfoot>
          </table></div>
        </Panel>
        <TenancyPanels />
      </div>
    </div>
  );
}
