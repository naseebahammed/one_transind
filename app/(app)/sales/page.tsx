import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getBreakdown, getDrill, getDrillLabels, getMonthly, getOverview } from "@/lib/data";
import {
  getComputedSalesIndicators,
  listEffectiveDepartmentTargets,
  mergeSalesSectorIndicators,
} from "@/lib/sales-indicators";
import { getSalesSectors } from "@/lib/sales-sectors";
import { getManagerTracking } from "@/lib/manager-tracking";
import { computeTargetAttainment, listSalesSectorIndicators, resolveSectorIndicators } from "@/lib/sales-targets";
import { fmt, MONTHS, money, pct, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { CompareChart } from "@/components/charts";
import { MonthSelect } from "@/components/MonthSelect";
import { Delta, Insights, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Sales · One Transind" };
type Params = Promise<{ m?: string; p?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const M = (x: number) => x / 1e6;

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const [{ m, p, all }, o, sectors] = await Promise.all([searchParams, getOverview(), getSalesSectors()]);
  const rawM = Number(m);
  const month = Math.min(o.month, Math.max(0, m && Number.isInteger(rawM) && rawM >= 1 ? rawM - 1 : o.month));
  const path = parsePath(p), dept = path[0] ?? "";
  const deptLabel = dept ? (sectors.find((s) => s.key === dept)?.label ?? dept) : "";
  const periodIso = `${o.year}-${String(month + 1).padStart(2, "0")}-01`;
  const [hist, top, subRows, labels, dep, deptTargets, indicatorRows, computedIndicators, tracking] = await Promise.all([
    getMonthly(dept),
    getDrill(month, "p", []),
    path.length ? getDrill(month, "p", path) : Promise.resolve(null),
    getDrillLabels(month, "p", path),
    getBreakdown(month, "dept"),
    listEffectiveDepartmentTargets(o.year),
    listSalesSectorIndicators(periodIso),
    getComputedSalesIndicators(month, dept, deptLabel),
    getManagerTracking(periodIso).catch(() => null), // the ERP view only exists on the live server
  ]);
  const rows = subRows ?? top;
  const years = [o.year - 2, o.year - 1, o.year];
  const val = (y: number, i: number) => (y === o.year && i > o.month ? null : (hist.find((h) => h.year === y && h.month === i + 1)?.value ?? 0));
  const series = years.map((y) => Array.from({ length: 12 }, (_, i) => { const v = val(y, i); return v == null ? null : M(v); }));
  const [g24, g25, g26] = series.map((s) => s.map((v) => v ?? 0));
  const ytd = sum(g26.slice(0, month + 1)), ytdL = sum(g25.slice(0, month + 1));
  const mn = MONTHS[month], upTo = month === o.month ? ` (1–${o.day})` : ""; // the month still running is counted up to the latest data day, and so are its comparisons
  const q = (patch: Record<string, string | undefined>) => link("/sales", { m: String(month + 1), p: path.join("|"), ...patch });

  // analysis: growth by department (or by brand inside a department), peak season, YTD
  const grow = rows.filter((r) => r.lastYear).map((r) => ({ ...r, g: pct(r.value, r.lastYear) })).sort((a, b) => b.g - a.g);
  const topBrand = (path.length ? rows : top)[0];
  const peak = g25.indexOf(Math.max(...g25));
  const out: [string, string][] = [];
  if (grow.length > 1) {
    out.push(["good", `${grow[0].label} grew fastest in ${mn}: ${fmt(grow[0].g, 1)}% vs ${years[1]}.`]);
    const w = grow[grow.length - 1];
    out.push(w.g < 0 ? ["bad", `${w.label} declined most in ${mn}: ${fmt(Math.abs(w.g), 1)}% vs ${years[1]}.`] : ["plain", `No decline in ${mn}: every line is at or above ${years[1]}.`]);
  }
  if (topBrand) out.push(["plain", `${topBrand.label} is the largest line in ${mn} with ${fmt(sum((path.length ? rows : top).map((r) => r.value)) ? topBrand.value / sum((path.length ? rows : top).map((r) => r.value)) * 100 : 0, 1)}% of sales.`]);
  out.push(["plain", `Year to date ${fmt(ytd, 1)} M, ${fmt(pct(ytd, ytdL), 1)}% vs the same months of ${years[1]}.`]);
  if (g25[peak]) out.push(["plain", `${MONTHS[peak]} was the strongest month of ${years[1]} with ${fmt(g25[peak], 1)} M.`]);

  const deptRow = dept ? top.find((r) => r.key === dept) : undefined;
  const credit = dept ? (dep.rows.find((r) => r.key === (deptRow?.label ?? dept))?.creditNotes ?? 0) : sum(dep.rows.map((r) => r.creditNotes));
  const sectorSales = dept ? (deptRow?.value ?? 0) : sum(top.map((r) => r.value));
  const relevantCodes = dept ? new Set([dept]) : new Set(sectors.map((s) => s.key));
  const monthTargetRows = deptTargets.filter((t) => t.month === month && relevantCodes.has(t.code));
  const targetMonthQar = monthTargetRows.length ? sum(monthTargetRows.map((t) => t.target)) : null;
  const attainment = computeTargetAttainment(val(o.year, month) ?? 0, targetMonthQar);
  const indicators = mergeSalesSectorIndicators(computedIndicators, resolveSectorIndicators(indicatorRows, dept));
  const indMoney = (v: number | undefined) => (v !== undefined ? money(v) : undefined);
  const indPct = (v: number | undefined) => (v !== undefined ? `${fmt(v, 1)}%` : undefined);
  const sectorKpis: [string, string?][] = [
    ["Van sales", indMoney(indicators.get("van_sales"))],
    ["Key accounts", indMoney(indicators.get("key_accounts"))],
    ["HORECA", indMoney(indicators.get("horeca"))],
    ["Wholesale", indMoney(indicators.get("wholesale"))],
    ["Returns rate", `${fmt(sectorSales ? -credit / sectorSales * 100 : 0, 1)}%`],
    ["Out-of-stock loss", indMoney(indicators.get("out_of_stock_loss"))],
    ["Price realisation", indPct(indicators.get("price_realisation"))],
    ["Promo uplift", indPct(indicators.get("promo_uplift"))],
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <MonthSelect value={month} max={o.month} names={MONTHS} year={o.year} base={link("/sales", { p: path.join("|") })} />
        <div className="tabs">
          <Link href={link("/sales", { m: String(month + 1) })} aria-pressed={!dept}>All</Link>
          {sectors.map((s) => <Link key={s.key} href={link("/sales", { m: String(month + 1), p: s.key })} aria-pressed={dept === s.key}>{s.label}</Link>)}
        </div>
      </div>
      <div className="kpis">
        <Kpi label={`Sales ${mn}${upTo}`} value={`${fmt(g26[month], 2)} M`} delta={<><Delta a={g26[month]} b={g25[month]} /> vs {mn} {years[1]}</>} spark={g26.slice(0, o.month + 1)} />
        <Kpi label={`vs ${mn} ${years[0]}`} value={`${fmt(g24[month], 2)} M`} delta={<Delta a={g26[month]} b={g24[month]} />} spark={g24} />
        <Kpi label="Year to date" value={`${fmt(ytd, 1)} M`} delta={<><Delta a={ytd} b={ytdL} /> vs same period last year</>} spark={g26.slice(0, month + 1)} />
        <Kpi
          label="Target attainment"
          value={attainment !== null ? `${fmt(attainment, 1)}%` : <NotConnected />}
          delta={targetMonthQar !== null ? `Target ${fmt(M(targetMonthQar), 2)} M` : undefined}
          up={attainment !== null ? attainment >= 100 : undefined}
        />
      </div>
      <div className="grid">
        <Panel span={12} title={`Monthly comparison: ${years[2]} vs ${years[1]} and ${years[0]}${dept ? " · " + deptLabel : ""}`}>
          <CompareChart years={years} series={series} sel={month} href={(i) => q({ m: String(i + 1) })} />
          <p className="note" style={{ marginTop: 8 }}>{MONTHS[o.month]} {o.year} has data for days 1–{o.day} only; every other bar is a full month.</p>
        </Panel>
        <Drill
          title={`Sales breakdown · ${mn} ${o.year}`} mode="yoy" rows={rows} labels={labels} path={path}
          levels={["Departments", "Brands", "Products"]} rootLabel="All" all={all === "1"} yoyLabels={[`${mn} ${years[1]}`, `${mn} ${years[0]}`]}
          href={(pp, a) => link("/sales", { m: String(month + 1), p: pp.join("|"), all: a ? "1" : undefined })}
        />
        {!dept && tracking && tracking.rows.some((r) => r.target > 0) && (
          <Panel span={12} title={`Manager targets · ${mn} ${o.year}`}>
            <div className="tw"><table>
              <thead><tr><th>Manager</th><th className="n">Target</th><th className="n">Sales</th><th className="n">%</th><th className="n">Balance</th><th className="n">Daily balance required</th><th className="n">Projected %</th></tr></thead>
              <tbody>{tracking.rows.map((r) => <tr key={r.manager}><td>{r.manager}</td><td className="n num">{r.target ? fmt(r.target) : "—"}</td><td className="n num">{fmt(r.sales)}</td><td className="n num">{r.achievedPct === null ? "—" : `${fmt(r.achievedPct, 1)}%`}</td><td className="n num">{r.target ? fmt(r.balance) : "—"}</td><td className="n num">{r.dailyRequired === null ? "—" : fmt(r.dailyRequired)}</td><td className="n num">{r.projectedPct === null ? "—" : `${fmt(r.projectedPct, 1)}%`}</td></tr>)}</tbody>
            </table></div>
            <p className="note" style={{ marginTop: 8 }}>QAR. Sales through {tracking.throughDate}; {tracking.daysGone} of {tracking.workingDays} working days gone, {tracking.daysLeft} left (Fridays off). Daily balance required = balance ÷ working days left. Projected % = current daily pace over the full month.</p>
          </Panel>
        )}
        <Insights title="Analysis" items={out} />
        <Panel span={6} title={`Sector indicators · ${dept ? deptLabel : "All"}`}>
          <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
            {sectorKpis.map(([l, v]) => <div className="kpi" key={l} style={{ padding: "10px 12px" }}><span className="l">{l}</span><span className="v" style={{ fontSize: 20 }}>{v ?? <NotConnected />}</span></div>)}
          </div>
        </Panel>
      </div>
    </>
  );
}
