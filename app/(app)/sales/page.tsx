import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getBreakdown, getDrill, getDrillLabels, getMonthly, getOverview } from "@/lib/data";
import { getSalesSectors } from "@/lib/sales-sectors";
import { fmt, MONTHS, pct, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { CompareChart } from "@/components/charts";
import { MonthSelect } from "@/components/MonthSelect";
import { Delta, Insights, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Sales · One Transind" };
type Params = Promise<{ m?: string; p?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const M = (x: number) => x / 1e6;

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const { m, p, all } = await searchParams;
  const o = await getOverview();
  const month = Math.min(o.month, Math.max(0, m ? +m - 1 || 0 : o.month));
  const path = parsePath(p), dept = path[0] ?? "";
  const [hist, rows, labels, sectors, top, dep] = await Promise.all([getMonthly(dept), getDrill(month, "p", path), getDrillLabels(month, "p", path), getSalesSectors(), getDrill(month, "p", []), getBreakdown(month, "dept")]);
  const years = [o.year - 2, o.year - 1, o.year];
  const val = (y: number, i: number) => (y === o.year && i > o.month ? null : (hist.find((h) => h.y === y && h.m === i + 1)?.v ?? 0));
  const series = years.map((y) => Array.from({ length: 12 }, (_, i) => { const v = val(y, i); return v == null ? null : M(v); }));
  const [g24, g25, g26] = series.map((s) => s.map((v) => v ?? 0));
  const ytd = sum(g26.slice(0, month + 1)), ytdL = sum(g25.slice(0, month + 1));
  const mn = MONTHS[month];
  const q = (patch: Record<string, string | undefined>) => link("/sales", { m: String(month + 1), p: path.join("|"), ...patch });

  // analysis: growth by department (or by brand inside a department), peak season, YTD
  const grow = rows.filter((r) => r.ly).map((r) => ({ ...r, g: pct(r.v, r.ly) })).sort((a, b) => b.g - a.g);
  const topBrand = (path.length ? rows : top)[0];
  const peak = g25.indexOf(Math.max(...g25));
  const out: [string, string][] = [];
  if (grow.length > 1) {
    out.push(["good", `${grow[0].label} grew fastest in ${mn}: ${fmt(grow[0].g, 1)}% vs ${years[1]}.`]);
    const w = grow[grow.length - 1];
    out.push(w.g < 0 ? ["bad", `${w.label} declined most in ${mn}: ${fmt(Math.abs(w.g), 1)}% vs ${years[1]}.`] : ["plain", `No decline in ${mn}: every line is at or above ${years[1]}.`]);
  }
  if (topBrand) out.push(["plain", `${topBrand.label} is the largest line in ${mn} with ${fmt(sum((path.length ? rows : top).map((r) => r.v)) ? topBrand.v / sum((path.length ? rows : top).map((r) => r.v)) * 100 : 0, 1)}% of sales.`]);
  out.push(["plain", `Year to date ${fmt(ytd, 1)} M, ${fmt(pct(ytd, ytdL), 1)}% vs the same months of ${years[1]}.`]);
  if (g25[peak]) out.push(["plain", `${MONTHS[peak]} was the strongest month of ${years[1]} with ${fmt(g25[peak], 1)} M.`]);

  const credit = sum(dep.rows.map((r) => r.cr));
  const sectorKpis: [string, string, string?][] = [
    ["Van sales", "0%"], ["Key accounts", "0%"], ["HORECA", "0%"], ["Wholesale", "0%"],
    ["Returns rate", `${fmt(sum(top.map((r) => r.v)) ? -credit / sum(top.map((r) => r.v)) * 100 : 0, 1)}%`],
    ["Out-of-stock loss", "0%"], ["Price realisation", "0%"], ["Promo uplift", "0%"],
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <MonthSelect value={month} max={o.month} names={MONTHS} year={o.year} base={link("/sales", { p: path.join("|") })} />
        <div className="tabs">
          <Link href={link("/sales", { m: String(month + 1) })} aria-pressed={!dept}>All</Link>
          {sectors.map((s) => <Link key={s.k} href={link("/sales", { m: String(month + 1), p: s.k })} aria-pressed={dept === s.k}>{s.label}</Link>)}
        </div>
      </div>
      <div className="kpis">
        <Kpi label={`Sales ${mn}`} value={`${fmt(g26[month], 2)} M`} delta={<><Delta a={g26[month]} b={g25[month]} /> vs {mn} {years[1]}</>} spark={g26.slice(0, o.month + 1)} />
        <Kpi label={`vs ${mn} ${years[0]}`} value={`${fmt(g24[month], 2)} M`} delta={<Delta a={g26[month]} b={g24[month]} />} spark={g24} />
        <Kpi label="Year to date" value={`${fmt(ytd, 1)} M`} delta={<><Delta a={ytd} b={ytdL} /> vs same period last year</>} spark={[ytdL * 0.3, ytdL * 0.52, ytdL * 0.78, ytdL, ytd]} />
        <Kpi label="Target attainment" value="0%" delta={`${fmt(g26[month], 1)} / 0 M`} />
      </div>
      <div className="grid">
        <Panel span={12} title={`Monthly comparison: ${years[2]} vs ${years[1]} and ${years[0]} (QAR M)${dept ? " · " + (sectors.find((s) => s.k === dept)?.label ?? dept) : ""}`}>
          <CompareChart years={years} series={series} sel={month} href={(i) => q({ m: String(i + 1) })} />
        </Panel>
        <Drill
          title={`Sales breakdown · ${mn} ${o.year}`} mode="yoy" rows={rows} labels={labels} path={path}
          levels={["Departments", "Brands", "Products"]} rootLabel="All" all={all === "1"} yoyLabels={[`${mn} ${years[1]}`, `${mn} ${years[0]}`]}
          href={(pp, a) => link("/sales", { m: String(month + 1), p: pp.join("|"), all: a ? "1" : undefined })}
        />
        <Insights title="Analysis" items={out} />
        <Panel span={6} title={`Sector indicators · ${dept ? sectors.find((s) => s.k === dept)?.label : "All"}`}>
          <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
            {sectorKpis.map(([l, v]) => <div className="kpi" key={l} style={{ padding: "10px 12px" }}><span className="l">{l}</span><span className="v" style={{ fontSize: 20 }}>{v}</span></div>)}
          </div>
        </Panel>
      </div>
    </>
  );
}
