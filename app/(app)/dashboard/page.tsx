import { getSalesSectors } from "@/lib/sales-sectors";
import { listSectors } from "@/lib/sectors";
import { keyFor, plRows, report, sum as amSum, years } from "@/lib/al-manzil";
import { listCompanies } from "@/lib/companies";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDrill, getDrillLabels, getOverview } from "@/lib/data";
import { fmt, MONTHS, money, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { CompareChart, LineChart } from "@/components/charts";
import { HBars, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Group dashboard · One Transind" };
type Params = Promise<{ p?: string; all?: string }>;
const FILE_SECTORS = [["hb", "Health & Beauty"], ["retail", "Hypermarkets & Retail"]] as const;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const { p, all } = await searchParams;
  const path = parsePath(p);
  const o = await getOverview();
  const [rows, labels, depts, adminSectors, fileCos, reCos] = await Promise.all([getDrill(o.month, "p", path), getDrillLabels(o.month, "p", path), getSalesSectors(true), listSectors(),
    Promise.all(FILE_SECTORS.map(([k]) => listCompanies("", k))), listCompanies("", "re")]);
  // Revenue by admin sector: departments are mapped to one under Admin → Sales sectors; the rest fall under "Unassigned".
  const known = new Set(adminSectors.map(([k]) => k));
  const bySector = new Map<string, number>();
  for (const d of depts) { const k = d.sector && known.has(d.sector) ? d.sector : ""; bySector.set(k, (bySector.get(k) ?? 0) + d.v); }
  // Health & Beauty (Pavati) and Retail (Top Perfume) companies report monthly sales through Admin → Finance, not the sales table.
  const fileSales = FILE_SECTORS.map(([k, name], i) => {
    const cos = fileCos[i].filter((c) => c.active && !c.hidden), keys = cos.map(keyFor);
    const rev = (y: number) => report(y, keys, plRows(y, keys, "sales")).revenue;
    bySector.set(k, (bySector.get(k) ?? 0) + amSum(rev(o.year).slice(0, o.month + 1)));
    return { k, name, cos, rev, ys: years(keys, "sales").slice(-3) };
  });
  // Real Estate, same months as the other sectors: each property's P&L, or its monthly sales grid when that year's P&L is not uploaded yet (Al Manzil 2026).
  bySector.set("re", (bySector.get("re") ?? 0) + amSum(reCos.filter((c) => c.active && !c.hidden).map((c) => {
    const key = keyFor(c);
    return amSum(report(o.year, key, years(key).includes(o.year) ? undefined : plRows(o.year, key, "sales")).revenue.slice(0, o.month + 1));
  })));
  const sectors = [...adminSectors.map(([k, name]) => ({ label: name, v: bySector.get(k) ?? 0 })), ...(bySector.get("") ? [{ label: "Unassigned", v: bySector.get("")! }] : [])];
  const cur = o.months[o.month], ytd = sum(o.months.map((m) => m.v));
  const monthly = o.months.map((m) => m.v / 1e6);
  const label = `${MONTHS[o.month]} ${o.year}`;

  return (
    <>
      <div className="kpis">
        <Kpi label="Sales this month" value={money(cur.v)} delta={label} spark={monthly} />
        <Kpi label="Revenue year to date" value={`${fmt(ytd / 1e6)} M`} spark={monthly} up />
        <Kpi label="Open pipeline value" value={<NotConnected />} />
        <Kpi label="Receivables outstanding" value={<NotConnected />} />
        <Kpi label="Employees" value={<NotConnected />} />
        <Kpi label="On-time delivery" value={<NotConnected />} />
      </div>
      <div className="grid">
        <Drill
          title="Sales this month" src={label} mode="mom" rows={rows} labels={labels} path={path}
          levels={["Departments", "Brands", "Products"]} rootLabel="All companies" all={all === "1"}
          href={(pp, a) => link("/dashboard", { p: pp.join("|"), all: a ? "1" : undefined })}
        />
        <Panel span={7} title="Group monthly revenue">
          <LineChart actual={monthly} target={[]} />
        </Panel>
        <Panel span={5} title={`Revenue by sector (QAR M, Jan–${MONTHS[o.month]} ${o.year})`}>
          <HBars rows={sectors.map((s) => ({ l: s.label, v: s.v / 1e6 }))} unit=" M" />
        </Panel>
        {fileSales.filter((s) => s.ys.length).map((s) => (
          <Panel key={s.k} span={12} title={`${s.name} sales by month (${s.cos.filter((c) => years(keyFor(c), "sales").length).map((c) => c.name).join(", ")})`}>
            <CompareChart years={s.ys} series={s.ys.map((y) => s.rev(y).map((v) => v / 1e6 || null))} sel={s.ys.at(-1) === o.year ? o.month : -1} />
          </Panel>
        ))}
        <Panel span={12} title="Needs follow-up">
          <div className="tw"><table><tbody>
            <tr><td><span className="chip bad">Over 90 days</span></td><td>Receivables</td><td className="n"><NotConnected /></td></tr>
            <tr><td><span className="chip warn">Late</span></td><td>Shipment tracking</td><td className="n"><NotConnected /></td></tr>
            <tr><td><span className="chip warn">Pending</span></td><td>Leave requests awaiting approval</td><td className="n"><NotConnected /></td></tr>
            <tr><td><span className="chip warn">Documents expiring</span></td><td>HR documents</td><td className="n"><NotConnected /></td></tr>
          </tbody></table></div>
        </Panel>
      </div>
    </>
  );
}
