import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { getBreakdown, getDrill, getDrillLabels, getMonthly, getOverview, getStats } from "@/lib/data";
import { fmt, MONTHS, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { MonthSelect } from "@/components/MonthSelect";
import { YearSelect } from "@/components/YearSelect";
import { Insights, Kpi, MarginChip, Panel } from "@/components/ui";

export const metadata = { title: "Trading sales (actual) · One Transind" };
type Params = Promise<{ m?: string; year?: string; p?: string; c?: string; q?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const mPct = (s: number, c: number) => (s ? (s - c) / s * 100 : 0);

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const [{ m, year: rawYear, p, c, q, all }, o, monthly] = await Promise.all([searchParams, getOverview(), getMonthly()]);
  const rawM = Number(m);
  const allMonths = m === "all";
  const month = allMonths ? "all" as const : Math.min(11, Math.max(0, m && Number.isInteger(rawM) && rawM >= 1 ? rawM - 1 : o.month));
  const years = [...new Set([o.year, ...monthly.map((r) => r.year)])].sort((a, b) => b - a);
  const year = years.includes(Number(rawYear)) ? Number(rawYear) : o.year;
  const pp = parsePath(p), cp = parsePath(c);
  const [prow, plab, crow, clab, groups, brands, dept] = await Promise.all([
    getDrill(month, "p", pp, [], year), getDrillLabels(month, "p", pp), getDrill(month, "c", cp, [], year), getDrillLabels(month, "c", cp),
    getStats(month, "group", year), getStats(month, "brand", year), getBreakdown(month, "dept", year),
  ]);
  const tot = sum(dept.rows.map((r) => r.value)), cost = sum(dept.rows.map((r) => r.cost)), ret = sum(dept.rows.map((r) => r.creditNotes));
  const active = dept.customers;
  const mn = month === "all" ? `All months ${year}` : `${MONTHS[month]} ${year}`;
  const monthParam = month === "all" ? "all" : String(month + 1);
  const href = (kind: "p" | "c") => (path: string[], a?: boolean) =>
    link("/trading", { m: monthParam, year: String(year), p: kind === "p" ? path.join("|") : pp.join("|"), c: kind === "c" ? path.join("|") : cp.join("|"), q, all: a ? kind : undefined });

  const topGroups = groups.slice(0, 10), top10 = sum(topGroups.map((g) => g.value));
  const delivery = sum(groups.filter((g) => /talabat|snoonu/i.test(g.key)).map((g) => g.value));
  const lowBrands = brands.filter((b) => b.value > 50000 && mPct(b.value, b.cost) < 15).map((b) => b.key);
  const worstDept = [...dept.rows].sort((a, b) => a.creditNotes - b.creditNotes)[0];
  const insights: [string, string][] = tot ? [
    ...(brands.length ? [["warn", `${brands[0].key} is ${fmt(brands[0].value / tot * 100, 1)}% of sales; the top 3 brands (${brands.slice(0, 3).map((b) => b.key).join(", ")}) make ${fmt(sum(brands.slice(0, 3).map((b) => b.value)) / tot * 100, 1)}%.`] as [string, string]] : []),
    ...(groups.length ? [["warn", `The top 10 customer groups make ${fmt(top10 / tot * 100, 1)}% of sales; the largest, ${groups[0].key}, is ${fmt(groups[0].value / tot * 100, 1)}% across ${groups[0].customers} branches.`] as [string, string]] : []),
    ["good", `Delivery apps (Talabat, Snoonu) sold ${fmt(delivery / 1e6, 2)} M, ${fmt(delivery / tot * 100, 1)}% of sales.`],
    ["bad", `Credit notes total ${fmt(-ret / 1e6, 2)} M (${fmt(-ret / tot * 100, 1)}% of sales)${worstDept ? `, most in ${worstDept.key}` : ""}.`],
    ["plain", `Gross margin is ${fmt(mPct(tot, cost), 1)}%. Brands above 50k QAR under 15% margin: ${lowBrands.slice(0, 5).join(", ") || "none"}.`],
    ["plain", `${fmt(active)} customers bought ${fmt(dept.items)} different items ${allMonths ? "in this period" : "this month"}.`],
  ] : [];

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginInlineEnd: "auto" }}>Trading sales (actual) · {mn}</h2>
        <MonthSelect value={month} allLabel="All months" max={11} names={MONTHS} year={year} base={link("/trading", { year: String(year) })} />
        <YearSelect years={years} value={year} base={link("/trading", { m: monthParam })} />
        <span className="live"><i></i>Actual</span>
        <form action="/trading"><input type="hidden" name="m" value={monthParam} /><input type="hidden" name="year" value={year} />{p && <input type="hidden" name="p" value={p} />}{c && <input type="hidden" name="c" value={c} />}{all && <input type="hidden" name="all" value={all} />}<input className="search" name="q" type="search" defaultValue={q ?? ""} placeholder="Search brand, product or customer" aria-label="Search" /></form>
      </div>
      <div className="kpis">
        <Kpi label={`Sales ${mn}`} value={`${fmt(tot / 1e6, 2)} M`} delta={fmt(tot)} up />
        <Kpi label="Gross margin" value={`${fmt(mPct(tot, cost), 1)}%`} delta={`Cost: ${fmt(cost / 1e6, 2)} M`} up />
        <Kpi label="Active customers" value={fmt(active)} delta={`${groups.length} chains`} />
        <Kpi label="Items sold" value={fmt(dept.items)} delta={`${brands.length} brands`} />
        <Kpi label="Returns" value={`${fmt(ret / 1e6, 2)} M`} delta={`${fmt(tot ? -ret / tot * 100 : 0, 1)}% of sales`} />
        <Kpi label="Avg per customer" value={fmt(active ? tot / active : 0)} up />
      </div>
      <div className="grid">
        <Drill span={6} title="Products drill-down" mode="margin" rows={prow} labels={plab} path={pp} levels={["Departments", "Brands", "Products"]} rootLabel="All" q={q} all={all === "p"} href={href("p")} />
        <Drill span={6} title="Customers drill-down" limit={10} mode="margin" rows={crow} labels={clab} path={cp} levels={["Groups", "Branches / customers", "Brands", "Products"]} rootLabel="All" q={q} all={all === "c"} href={href("c")} />
        <Insights title="Analysis" items={insights} />
        <Panel span={6} title="Top customer groups">
          <div className="tw"><table>
            <thead><tr><th>Group</th><th className="n">Value</th><th className="n">Share</th><th className="n">Margin</th><th className="n">Branches</th></tr></thead>
            <tbody>{topGroups.map((x) => <tr key={x.key}><td>{x.key}</td><td className="n num">{fmt(x.value)}</td><td className="n num">{fmt(tot ? x.value / tot * 100 : 0, 1)}%</td><td className="n"><MarginChip s={x.value} c={x.cost} /></td><td className="n num">{x.customers}</td></tr>)}</tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Top brands" src="Top 10 by sales">
          <div className="tw scroll"><table>
            <thead><tr><th>Brand</th><th className="n">Value</th><th className="n">Margin</th><th className="n">Items</th><th className="n">Customers</th></tr></thead>
            <tbody>{[...brands].sort((a, b) => b.value - a.value).slice(0, 10).map((x) => <tr key={x.key}><td>{x.key}</td><td className="n num">{fmt(x.value)}</td><td className="n"><MarginChip s={x.value} c={x.cost} /></td><td className="n num">{x.items}</td><td className="n num">{x.customers}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
