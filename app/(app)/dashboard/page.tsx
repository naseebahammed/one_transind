import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { canOpen } from "@/lib/modules";
import { SECTOR, SECTORS } from "@/lib/org";
import { listSectors } from "@/lib/sectors";
import { keyFor, plRows, report, years, loadReports } from "@/lib/reports";
import { listCompanies, type Company } from "@/lib/companies";
import { listEmployees } from "@/lib/employee-records";
import {
  buildCompanyMonthlySeries,
  computeGroupMonthlyRevenue,
  computeGroupMonthlyTargetsMillions,
  listSubsidiaryMonthlyBudgetRevenue,
  listSubsidiaryMonthlyRevenue,
} from "@/lib/group-revenue";
import { getLogisticsOverview } from "@/lib/manual-report-records";
import { getCombinedReceivables, type CombinedReceivables } from "@/lib/receivables-rollup";
import { listEffectiveDepartmentTargets } from "@/lib/sales-indicators";
import { getWarehouseSummary } from "@/lib/warehouse-summary";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDrill, getOverview, type DrillRow } from "@/lib/data";
import { fmt, MONTHS, money, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { translator, type Language } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { Drill } from "@/components/Drill";
import { CompareChart, LineChart } from "@/components/charts";
import { HBars, Kpi, NotConnected, Panel } from "@/components/ui";
import { KpiSkeleton, PageSkeleton, PanelSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Group dashboard · One Transind" };
type Params = Promise<{ p?: string; all?: string }>;
const sectorName = new Map<string, string>(SECTORS);
const FILE_SECTORS = [SECTOR.healthBeauty, SECTOR.retail].map((k) => [k, sectorName.get(k)!] as const);

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={4} panels={2} />}><Content searchParams={searchParams} /></Suspense>;
}

async function ReceivablesKpi({
  arPromise,
  language,
  canFinance,
}: {
  arPromise: Promise<CombinedReceivables | null>;
  language: Language;
  canFinance: boolean;
}) {
  const ar = await arPromise;
  const translate = translator(language);
  return (
    <Kpi
      label={translate("Receivables outstanding")}
      value={ar ? money(ar.total) : <NotConnected label={translate("Not connected")} />}
      unit={ar ? "QAR" : undefined}
      delta={ar ? ar.sourceLabel : undefined}
      up
      href={canFinance ? "/finance" : undefined}
    />
  );
}

async function EmployeesKpi({
  staffPromise,
  language,
  canHr,
}: {
  staffPromise: ReturnType<typeof listEmployees>;
  language: Language;
  canHr: boolean;
}) {
  const staff = await staffPromise;
  const translate = translator(language);
  const activeStaff = staff.filter((e) => !e.left).length;
  return (
    <Kpi
      label={translate("Employees")}
      value={staff.length ? fmt(activeStaff) : <NotConnected label={translate("Not connected")} />}
      delta={staff.length ? `${fmt(staff.length)} ${translate("total on file")}` : undefined}
      up
      href={canHr ? "/hr" : undefined}
    />
  );
}

async function TradingDrillPanel({
  erpDrillPromise,
  title,
  src,
  labels,
  path,
  levels,
  rootLabel,
  all,
  language,
}: {
  erpDrillPromise: Promise<DrillRow[]>;
  title: string;
  src: string;
  labels: string[];
  path: string[];
  levels: string[];
  rootLabel: string;
  all: boolean;
  language: Language;
}) {
  const rows = await erpDrillPromise;
  return (
    <Drill
      title={title}
      src={src}
      mode="mom"
      rows={rows}
      labels={labels}
      path={path}
      levels={levels}
      rootLabel={rootLabel}
      all={all}
      language={language}
      href={(pp, a) => link("/dashboard", { p: pp.join("|"), all: a ? "1" : undefined })}
    />
  );
}

async function FileSalesPanels({
  reportsPromise,
  allCompanies,
  year,
  month,
  language,
}: {
  reportsPromise: ReturnType<typeof loadReports>;
  allCompanies: Company[];
  year: number;
  month: number;
  language: Language;
}) {
  const reports = await reportsPromise;
  const translate = translator(language);
  const fileSectorCompanies = FILE_SECTORS.map(([k]) => allCompanies.filter((c) => c.sector === k));
  const fileSales = FILE_SECTORS.map(([k, name], i) => {
    const cos = fileSectorCompanies[i].filter((c) => c.active && !c.hidden), keys = cos.map(keyFor);
    const rev = (y: number) => report(reports, y, keys, plRows(reports, y, keys, "sales")).revenue;
    return { k, name, cos, rev, ys: years(reports, keys, "sales").slice(-3) };
  }).filter((s) => s.ys.length);
  const fileSpan = fileSales.length >= 2 ? 6 : 12;
  return (
    <>
      {fileSales.map((s) => (
        <Panel key={s.k} span={fileSpan} title={`${s.name} ${translate("sales by month")} (${s.cos.filter((c) => years(reports, keyFor(c), "sales").length).map((c) => c.name).join(", ")})`}>
          <CompareChart years={s.ys} series={s.ys.map((y) => s.rev(y).map((v) => v / 1e6 || null))} sel={s.ys.at(-1) === year ? month : -1} />
        </Panel>
      ))}
    </>
  );
}

async function FollowUpPanel({
  arPromise,
  logisticsPromise,
  warehousePromise,
  language,
  canFinance,
  canLogistics,
}: {
  arPromise: Promise<CombinedReceivables | null>;
  logisticsPromise: ReturnType<typeof getLogisticsOverview>;
  warehousePromise: ReturnType<typeof getWarehouseSummary>;
  language: Language;
  canFinance: boolean;
  canLogistics: boolean;
}) {
  const [ar, logistics, warehouseSummary] = await Promise.all([arPromise, logisticsPromise, warehousePromise]);
  const translate = translator(language);
  const notConnectedLabel = translate("Not connected");
  const lateShipments = logistics.shipments.filter((s) => ["late", "delayed"].includes(s.status.toLowerCase())).length;
  const hasShipmentFeed = logistics.shipments.length > 0;
  const hasVarianceFeed = warehouseSummary.shortDeliveryOrders > 0;

  return (
    <Panel span={12} title={translate("Needs follow-up")}>
      <div className="tw"><table><tbody>
        <tr>
          <td><span className="chip bad">{translate("Over 90 days")}</span></td>
          <td>{translate("Receivables")}{ar ? ` · ${ar.sourceLabel}` : ""}</td>
          <td className={`n${ar ? " num" : ""}`}>{ar ? `${money(ar.over90)} QAR` : <NotConnected label={notConnectedLabel} />}</td>
          <td className="n">
            {canFinance && (
              <Link href="/finance" className="followup-link">
                <span>{translate("View")}</span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            )}
          </td>
        </tr>
        <tr>
          <td><span className="chip warn">{translate("Late")}</span></td>
          <td>{translate("Shipment tracking")}{!hasShipmentFeed && hasVarianceFeed ? ` · ${translate("Short-delivered orders (30d)")}` : ""}</td>
          <td className={`n${hasShipmentFeed || hasVarianceFeed ? " num" : ""}`}>
            {hasShipmentFeed ? fmt(lateShipments) : hasVarianceFeed ? fmt(warehouseSummary.shortDeliveryOrders) : <NotConnected label={notConnectedLabel} />}
          </td>
          <td className="n">
            {canLogistics && (
              <Link href="/logistics" className="followup-link">
                <span>{translate("View")}</span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            )}
          </td>
        </tr>
      </tbody></table></div>
    </Panel>
  );
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const { modules } = await requireUser("dashboard");
  const overview = getOverview();
  // Kick off secondary queries immediately so they execute in parallel while streaming in independently.
  const reportsPromise = loadReports();
  const staffPromise = listEmployees();
  const logisticsPromise = getLogisticsOverview();
  const warehousePromise = getWarehouseSummary();
  const arPromise = overview.then((ov) =>
    getCombinedReceivables({
      ytdErpSales: sum(ov.months.map((m) => m.value)),
      year: ov.year,
      month: ov.month,
      day: ov.day,
    }),
  );
  const erpDrillPromise = Promise.all([searchParams, overview]).then(([{ p }, o]) =>
    parsePath(p)[0] === SECTOR.trading ? getDrill(o.month, "p", []) : Promise.resolve([] as DrillRow[]),
  );

  const [
    language,
    { p, all },
    o,
    adminSectors,
    allCompanies,
    subsidiaryRows,
    subsidiaryBudgetMonths,
    erpTargets,
  ] = await Promise.all([
    getLanguage(),
    searchParams,
    overview,
    listSectors(),
    listCompanies(),
    overview.then((ov) => listSubsidiaryMonthlyRevenue([ov.year - 2, ov.year - 1, ov.year])),
    overview.then((ov) => listSubsidiaryMonthlyBudgetRevenue(ov.year)),
    overview.then((ov) => listEffectiveDepartmentTargets(ov.year)),
  ]);
  const translate = translator(language);
  const erpYtd = sum(o.months.map((m) => m.value));

  const path = parsePath(p);
  // Sector > company: ranked monthly revenue from rpt.company_monthly_revenue (P&L > daily stay > daily takings > monthly sales > COGS net sales).
  const salesOf = (c: Company, y: number) => buildCompanyMonthlySeries(subsidiaryRows, c.id, y);
  const companyRow = (c: Company): DrillRow => {
    const m = o.month, now = salesOf(c, o.year);
    return {
      key: String(c.id),
      label: c.name,
      sub: "",
      value: now[m],
      lastMonth: m ? now[m - 1] : salesOf(c, o.year - 1)[11],
      lastYear: salesOf(c, o.year - 1)[m],
      twoYearsAgo: salesOf(c, o.year - 2)[m],
      cost: 0,
      units: 0,
    };
  };
  // Transind Trading and Distribution is the ERP daily sales view: its figure is the ERP total, and its rows are the ERP departments.
  const erp = o.months[o.month];
  const sectorCompanies = (k: string) => allCompanies.filter((c) => c.sector === k && c.active && !c.hidden);
  const isTradingDrill = path[0] === SECTOR.trading;
  const rows: DrillRow[] = path.length === 0
    ? adminSectors.map(([k, name]) => {
        if (k === SECTOR.trading) return { key: k, label: name, sub: "ERP daily sales", value: erp.value, lastMonth: o.beforeToDate, lastYear: 0, twoYearsAgo: 0, cost: 0, units: 0 };
        const cos = sectorCompanies(k).map(companyRow);
        const total = (f: keyof DrillRow) => sum(cos.map((r) => r[f] as number));
        return { key: k, label: name, sub: `${cos.length} companies`, value: total("value"), lastMonth: total("lastMonth"), lastYear: total("lastYear"), twoYearsAgo: total("twoYearsAgo"), cost: 0, units: 0 };
      }).filter((r) => !r.sub.startsWith("0 ")).sort((x, y) => y.value - x.value)
    : isTradingDrill ? [] : sectorCompanies(path[0]).map(companyRow);
  const labels = path.length ? [adminSectors.find(([k]) => k === path[0])?.[1] ?? path[0]] : [];
  // Revenue by sector, January to the latest month: the sum of each sector's companies, matching group monthly revenue.
  const sectors = adminSectors.map(([k, name]) => ({
    label: name,
    v: k === SECTOR.trading ? erpYtd : sum(sectorCompanies(k).map((c) => sum(salesOf(c, o.year).slice(0, o.month + 1)))),
  }));
  const nonTradingCompanyIds = allCompanies
    .filter((c) => c.sector !== SECTOR.trading && c.active && !c.hidden)
    .map((c) => c.id);
  const groupMonthlyQar = computeGroupMonthlyRevenue({
    erpMonths: o.months,
    throughMonth: o.month,
    nonTradingCompanyIds,
    subsidiaryRows,
    year: o.year,
  });
  const curGroupQar = groupMonthlyQar[o.month] ?? erp.value;
  const ytdGroupQar = sum(groupMonthlyQar);
  const monthly = groupMonthlyQar.map((v) => v / 1e6);
  const monthlyTarget = computeGroupMonthlyTargetsMillions({
    throughMonth: o.month,
    year: o.year,
    erpTargets,
    subsidiaryBudgetMonths,
  });
  const label = `${MONTHS[o.month]} ${o.year} (1–${o.day})`;
  const drillLevels = ["Sectors", "Companies"].map((level) => translate(level));

  const canSales = canOpen(modules, "sales");
  const canFinance = canOpen(modules, "finance");
  const canHr = canOpen(modules, "hr");
  const canLogistics = canOpen(modules, "logistics");

  return (
    <>
      <div className="kpis">
        <Kpi
          label={translate("Sales this month")}
          value={money(curGroupQar)}
          unit="QAR"
          delta={label}
          spark={monthly}
          href={canSales ? "/sales" : undefined}
        />
        <Kpi
          label={translate("Revenue year to date")}
          value={`${fmt(ytdGroupQar / 1e6)} M`}
          unit="QAR"
          spark={monthly}
          up
          href={canSales ? "/sales" : undefined}
        />
        <Suspense fallback={<KpiSkeleton />}>
          <ReceivablesKpi arPromise={arPromise} language={language} canFinance={canFinance} />
        </Suspense>
        <Suspense fallback={<KpiSkeleton />}>
          <EmployeesKpi staffPromise={staffPromise} language={language} canHr={canHr} />
        </Suspense>
      </div>
      <div className="grid">
        {isTradingDrill ? (
          <Suspense fallback={<PanelSkeleton span={12} height={240} />}>
            <TradingDrillPanel
              erpDrillPromise={erpDrillPromise}
              title={translate("Sales this month")}
              src={label}
              labels={labels}
              path={path}
              levels={drillLevels}
              rootLabel={translate("All sectors")}
              all={all === "1"}
              language={language}
            />
          </Suspense>
        ) : (
          <Drill
            title={translate("Sales this month")} src={label} mode="mom" rows={rows} labels={labels} path={path}
            levels={drillLevels} rootLabel={translate("All sectors")} all={all === "1"}
            language={language}
            href={(pp, a) => link("/dashboard", { p: pp.join("|"), all: a ? "1" : undefined })}
          />
        )}
        <Panel span={7} title={translate("Group monthly revenue")}>
          <LineChart actual={monthly} target={monthlyTarget} />
        </Panel>
        <Panel span={5} title={`${translate("Revenue by sector")} (QAR M, Jan–${MONTHS[o.month]} ${o.year})`}>
          <HBars rows={sectors.map((s) => ({ l: s.label, v: s.v / 1e6 }))} unit=" M" />
        </Panel>
        <Suspense fallback={<><PanelSkeleton span={6} height={220} /><PanelSkeleton span={6} height={220} /></>}>
          <FileSalesPanels reportsPromise={reportsPromise} allCompanies={allCompanies} year={o.year} month={o.month} language={language} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton span={12} height={140} />}>
          <FollowUpPanel
            arPromise={arPromise}
            logisticsPromise={logisticsPromise}
            warehousePromise={warehousePromise}
            language={language}
            canFinance={canFinance}
            canLogistics={canLogistics}
          />
        </Suspense>
      </div>
    </>
  );
}
