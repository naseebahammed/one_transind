import { requireUser } from "@/lib/guard";
import { SECTOR, SECTORS } from "@/lib/org";
import { listSectors } from "@/lib/sectors";
import { keyFor, plRows, report, years, loadReports } from "@/lib/reports";
import { listCompanies, type Company } from "@/lib/companies";
import { listEmployees } from "@/lib/employee-records";
import { getAggregatedReceivables, getLogisticsOverview, listHrExpiringDocuments, listHrLeaveRequests } from "@/lib/manual-report-records";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDrill, getOverview, type DrillRow } from "@/lib/data";
import { fmt, MONTHS, money, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { Drill } from "@/components/Drill";
import { CompareChart, LineChart } from "@/components/charts";
import { HBars, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Group dashboard · One Transind" };
type Params = Promise<{ p?: string; all?: string }>;
const sectorName = new Map<string, string>(SECTORS);
const FILE_SECTORS = [SECTOR.healthBeauty, SECTOR.retail].map((k) => [k, sectorName.get(k)!] as const);

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const overview = getOverview();
  const erpDrill = Promise.all([searchParams, overview]).then(([{ p }, o]) =>
    parsePath(p)[0] === SECTOR.trading ? getDrill(o.month, "p", []) : Promise.resolve([] as DrillRow[]),
  );
  const [reports, { p, all }, o, adminSectors, allCompanies, erpRows, ar, staff, logistics, leaves, expiringDocs] = await Promise.all([
    loadReports(), searchParams, overview, listSectors(), listCompanies(), erpDrill,
    getAggregatedReceivables(), listEmployees(), getLogisticsOverview(), listHrLeaveRequests(), listHrExpiringDocuments(),
  ]);
  const fileSectorCompanies = FILE_SECTORS.map(([k]) => allCompanies.filter((c) => c.sector === k));
  const path = parsePath(p);
  // Sector > company. A company's sales are its P&L revenue, or its monthly sales grid when that year's P&L is not uploaded yet.
  const salesOf = (c: Company, y: number) => { const key = keyFor(c); return report(reports, y, key, years(reports, key).includes(y) ? undefined : plRows(reports, y, key, "sales")).revenue; };
  const companyRow = (c: Company): DrillRow => {
    const m = o.month, now = salesOf(c, o.year);
    return { key: String(c.id), label: c.name, sub: "", value: now[m], lastMonth: m ? now[m - 1] : salesOf(c, o.year - 1)[11], lastYear: salesOf(c, o.year - 1)[m], twoYearsAgo: salesOf(c, o.year - 2)[m], cost: 0, units: 0 };
  };
  // Transind Trading and Distribution is the ERP daily sales view: its figure is the ERP total, and its rows are the ERP departments.
  const erp = o.months[o.month];
  const sectorCompanies = (k: string) => allCompanies.filter((c) => c.sector === k && c.active && !c.hidden);
  const rows: DrillRow[] = path.length === 0
    ? adminSectors.map(([k, name]) => {
        if (k === SECTOR.trading) return { key: k, label: name, sub: "ERP daily sales", value: erp.value, lastMonth: o.beforeToDate, lastYear: 0, twoYearsAgo: 0, cost: 0, units: 0 };
        const cos = sectorCompanies(k).map(companyRow);
        const total = (f: keyof DrillRow) => sum(cos.map((r) => r[f] as number));
        return { key: k, label: name, sub: `${cos.length} companies`, value: total("value"), lastMonth: total("lastMonth"), lastYear: total("lastYear"), twoYearsAgo: total("twoYearsAgo"), cost: 0, units: 0 };
      }).filter((r) => !r.sub.startsWith("0 ")).sort((x, y) => y.value - x.value)
    : path[0] === SECTOR.trading ? erpRows : sectorCompanies(path[0]).map(companyRow);
  const labels = path.length ? [adminSectors.find(([k]) => k === path[0])?.[1] ?? path[0]] : [];
  // Health & Beauty (Pavati) and Retail (Top Perfume) companies report monthly sales through Admin → Finance, not the sales table.
  const fileSales = FILE_SECTORS.map(([k, name], i) => {
    const cos = fileSectorCompanies[i].filter((c) => c.active && !c.hidden), keys = cos.map(keyFor);
    const rev = (y: number) => report(reports, y, keys, plRows(reports, y, keys, "sales")).revenue;
    return { k, name, cos, rev, ys: years(reports, keys, "sales").slice(-3) };
  });
  // Revenue by sector, January to the latest month: the sum of each sector's companies, the same figures as the table above.
  const sectors = adminSectors.map(([k, name]) => ({ label: name, v: k === SECTOR.trading ? sum(o.months.map((m) => m.value)) : sum(sectorCompanies(k).map((c) => sum(salesOf(c, o.year).slice(0, o.month + 1)))) }));
  const cur = o.months[o.month], ytd = sum(o.months.map((m) => m.value));
  const monthly = o.months.map((m) => m.value / 1e6);
  const label = `${MONTHS[o.month]} ${o.year} (1–${o.day})`;
  const activeStaff = staff.filter((e) => !e.left).length;
  const lateShipments = logistics.shipments.filter((s) => ["late", "delayed"].includes(s.status.toLowerCase())).length;
  const pendingLeaves = leaves.filter((l) => l.status.toLowerCase() === "pending").length;

  return (
    <>
      <div className="kpis">
        <Kpi label="Sales this month" value={money(cur.value)} delta={label} spark={monthly} />
        <Kpi label="Revenue year to date" value={`${fmt(ytd / 1e6)} M`} spark={monthly} up />
        <Kpi label="Receivables outstanding" value={ar ? money(ar.total) : <NotConnected />} delta={ar ? `As of ${ar.latestAsOf}` : undefined} up />
        <Kpi label="Employees" value={staff.length ? fmt(activeStaff) : <NotConnected />} delta={staff.length ? `${fmt(staff.length)} total on file` : undefined} up />
      </div>
      <div className="grid">
        <Drill
          title="Sales this month" src={label} mode="mom" rows={rows} labels={labels} path={path}
          levels={["Sectors", "Companies"]} rootLabel="All sectors" all={all === "1"}
          href={(pp, a) => link("/dashboard", { p: pp.join("|"), all: a ? "1" : undefined })}
        />
        <Panel span={7} title="Group monthly revenue">
          <LineChart actual={monthly} target={[]} />
        </Panel>
        <Panel span={5} title={`Revenue by sector (QAR M, Jan–${MONTHS[o.month]} ${o.year})`}>
          <HBars rows={sectors.map((s) => ({ l: s.label, v: s.v / 1e6 }))} unit=" M" />
        </Panel>
        {fileSales.filter((s) => s.ys.length).map((s) => (
          <Panel key={s.k} span={12} title={`${s.name} sales by month (${s.cos.filter((c) => years(reports, keyFor(c), "sales").length).map((c) => c.name).join(", ")})`}>
            <CompareChart years={s.ys} series={s.ys.map((y) => s.rev(y).map((v) => v / 1e6 || null))} sel={s.ys.at(-1) === o.year ? o.month : -1} />
          </Panel>
        ))}
        <Panel span={12} title="Needs follow-up">
          <div className="tw"><table><tbody>
            <tr><td><span className="chip bad">Over 90 days</span></td><td>Receivables</td><td className={`n${ar ? " num" : ""}`}>{ar ? `${money(ar.over90)} QAR` : <NotConnected />}</td></tr>
            <tr><td><span className="chip warn">Late</span></td><td>Shipment tracking</td><td className={`n${logistics.shipments.length ? " num" : ""}`}>{logistics.shipments.length ? fmt(lateShipments) : <NotConnected />}</td></tr>
            <tr><td><span className="chip warn">Pending</span></td><td>Leave requests awaiting approval</td><td className={`n${leaves.length ? " num" : ""}`}>{leaves.length ? fmt(pendingLeaves) : <NotConnected />}</td></tr>
            <tr><td><span className="chip warn">Documents expiring</span></td><td>HR documents</td><td className={`n${expiringDocs.length ? " num" : ""}`}>{expiringDocs.length ? fmt(expiringDocs.length) : <NotConnected />}</td></tr>
          </tbody></table></div>
        </Panel>
      </div>
    </>
  );
}
