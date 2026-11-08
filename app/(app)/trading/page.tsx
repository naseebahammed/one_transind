import { Suspense } from "react";
import { connection } from "next/server";
import { getBreakdown, getDrill, getDrillLabels, getOverview, getStats } from "@/lib/data";
import { fmt, MONTHS, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { MonthSelect } from "@/components/MonthSelect";
import { Insights, Kpi, MarginChip, Panel } from "@/components/ui";

export const metadata = { title: "Trading sales (actual) · One Transind" };
type Params = Promise<{ m?: string; p?: string; c?: string; q?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const mPct = (s: number, c: number) => (s ? (s - c) / s * 100 : 0);

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const [{ m, p, c, q, all }, o] = await Promise.all([searchParams, getOverview()]);
  const rawM = Number(m);
  const month = Math.min(o.month, Math.max(0, m && Number.isInteger(rawM) && rawM >= 1 ? rawM - 1 : o.month));
  const pp = parsePath(p), cp = parsePath(c);
  const [prow, plab, crow, clab, groups, brands, dept] = await Promise.all([
    getDrill(month, "p", pp), getDrillLabels(month, "p", pp), getDrill(month, "c", cp), getDrillLabels(month, "c", cp),
    getStats(month, "group"), getStats(month, "brand"), getBreakdown(month, "dept"),
  ]);
  const tot = sum(dept.rows.map((r) => r.value)), cost = sum(dept.rows.map((r) => r.cost)), ret = sum(dept.rows.map((r) => r.creditNotes));
  const active = dept.customers;
  const mn = `${MONTHS[month]} ${o.year}`;
  const href = (kind: "p" | "c") => (path: string[], a?: boolean) =>
    link("/trading", { m: String(month + 1), p: kind === "p" ? path.join("|") : pp.join("|"), c: kind === "c" ? path.join("|") : cp.join("|"), q, all: a ? kind : undefined });

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
    ["plain", `${fmt(active)} customers bought ${fmt(dept.items)} different items this month.`],
  ] : [];

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginInlineEnd: "auto" }}>Trading sales (actual) · {mn}</h2>
        <MonthSelect value={month} max={o.month} names={MONTHS} year={o.year} base="/trading" />
        <span className="live"><i></i>Actual</span>
        <form action="/trading"><input type="hidden" name="m" value={month + 1} />{p && <input type="hidden" name="p" value={p} />}{c && <input type="hidden" name="c" value={c} />}{all && <input type="hidden" name="all" value={all} />}<input className="search" name="q" type="search" defaultValue={q ?? ""} placeholder="Search brand, product or customer" aria-label="Search" /></form>
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
        <Drill span={6} title="Customers drill-down" mode="margin" rows={crow} labels={clab} path={cp} levels={["Groups", "Branches / customers", "Brands", "Products"]} rootLabel="All" q={q} all={all === "c"} href={href("c")} />
        <Insights title="Analysis" items={insights} />
        <Panel span={6} title="Top customer groups">
          <div className="tw"><table>
            <thead><tr><th>Group</th><th className="n">Value</th><th className="n">Share</th><th className="n">Margin</th><th className="n">Branches</th></tr></thead>
            <tbody>{topGroups.map((x) => <tr key={x.key}><td>{x.key}</td><td className="n num">{fmt(x.value)}</td><td className="n num">{fmt(tot ? x.value / tot * 100 : 0, 1)}%</td><td className="n"><MarginChip s={x.value} c={x.cost} /></td><td className="n num">{x.customers}</td></tr>)}</tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Brand margin" src="Brands above QAR 100k">
          <div className="tw scroll"><table>
            <thead><tr><th>Brand</th><th className="n">Value</th><th className="n">Margin</th><th className="n">Items</th><th className="n">Customers</th></tr></thead>
            <tbody>{brands.filter((b) => b.value > 100000).sort((a, b) => mPct(b.value, b.cost) - mPct(a.value, a.cost)).map((x) => <tr key={x.key}><td>{x.key}</td><td className="n num">{fmt(x.value)}</td><td className="n"><MarginChip s={x.value} c={x.cost} /></td><td className="n num">{x.items}</td><td className="n num">{x.customers}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
