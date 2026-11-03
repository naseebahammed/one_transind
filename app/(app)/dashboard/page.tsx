import { getSalesSectors } from "@/lib/sales-sectors";
import { listSectors } from "@/lib/sectors";
import { report, sum as amSum, years } from "@/lib/al-manzil";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDrill, getDrillLabels, getOverview } from "@/lib/data";
import { fmt, MONTHS, money, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { LineChart } from "@/components/charts";
import { HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Group dashboard · One Transind" };
type Params = Promise<{ p?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const { p, all } = await searchParams;
  const path = parsePath(p);
  const o = await getOverview();
  const [rows, labels, depts, adminSectors] = await Promise.all([getDrill(o.month, "p", path), getDrillLabels(o.month, "p", path), getSalesSectors(true), listSectors()]);
  // Revenue by admin sector: departments are mapped to one under Admin → Sales sectors; the rest fall under "Unassigned".
  const known = new Set(adminSectors.map(([k]) => k));
  const bySector = new Map<string, number>();
  for (const d of depts) { const k = d.sector && known.has(d.sector) ? d.sector : ""; bySector.set(k, (bySector.get(k) ?? 0) + d.v); }
  const sectors = [...adminSectors.map(([k, name]) => ({ label: name, v: bySector.get(k) ?? 0 })), ...(bySector.get("") ? [{ label: "Unassigned", v: bySector.get("")! }] : [])];
  const cur = o.months[o.month], ytd = sum(o.months.map((m) => m.v));
  const monthly = o.months.map((m) => m.v / 1e6);
  const label = `${MONTHS[o.month]} ${o.year}`;
  const zero = [0, 0];
  const amYear = years().at(-1)!; // Real Estate = Al Manzil P&L, which is a full past year, not the sales period

  return (
    <>
      <div className="kpis">
        <Kpi label="Sales this month" value={money(cur.v)} delta={label} spark={monthly} />
        <Kpi label="Revenue year to date" value={`${fmt(ytd / 1e6)} M`} spark={monthly} up />
        <Kpi label="Open pipeline value" value="0" delta="0 open deals" spark={zero} />
        <Kpi label="Receivables outstanding" value="0" spark={zero} />
        <Kpi label="Employees" value="0" spark={zero} />
        <Kpi label="On-time delivery" value="0%" spark={zero} />
      </div>
      <div className="grid">
        <Drill
          title="Sales this month" src={label} mode="mom" rows={rows} labels={labels} path={path}
          levels={["Departments", "Brands", "Products"]} rootLabel="All companies" all={all === "1"}
          href={(pp, a) => link("/dashboard", { p: pp.join("|"), all: a ? "1" : undefined })}
        />
        <Panel span={7} title="Group monthly revenue (QAR M)">
          <LineChart actual={monthly} target={Array(12).fill(0)} />
        </Panel>
        <Panel span={5} title={`Revenue by sector (QAR M, Jan–${MONTHS[o.month]} ${o.year})`}>
          <HBars rows={[...sectors.map((s) => ({ l: s.label, v: s.v / 1e6, extra: "0% of target" })), { l: `Real Estate (Al Manzil ${amYear}, full year)`, v: amSum(report(amYear).revenue) / 1e6, extra: "0% of target" }]} unit=" M" />
        </Panel>
        <Panel span={12} title="Needs follow-up">
          <div className="tw"><table><tbody>
            <tr><td><span className="chip bad">Over 90 days</span></td><td>No receivables source connected</td><td className="n num">0</td></tr>
            <tr><td><span className="chip warn">Late</span></td><td>No shipment tracking source connected</td><td className="n num">0</td></tr>
            <tr><td><span className="chip warn">Pending</span></td><td>Leave requests awaiting approval</td><td className="n num">0</td></tr>
            <tr><td><span className="chip warn">Documents expiring</span></td><td>No HR source connected</td><td className="n num">0</td></tr>
          </tbody></table></div>
        </Panel>
      </div>
    </>
  );
}
