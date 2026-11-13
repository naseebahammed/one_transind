import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getDrill, getDrillLabels, getMonthly, getOverview, getSalesReturns, type DrillRow, type MonthPick } from "@/lib/data";
import {
  getComputedSalesIndicators,
  listEffectiveDepartmentTargets,
  mergeSalesSectorIndicators,
} from "@/lib/sales-indicators";
import { getSalesSectors } from "@/lib/sales-sectors";
import { getManagerTracking, getSalesmanTracking, type ManagerTrackingRow } from "@/lib/manager-tracking";
import { computeTargetAttainment, listSalesSectorIndicators, resolveSectorIndicators } from "@/lib/sales-targets";
import { fmt, MONTHS, money, pct, sum } from "@/lib/format";
import { link, parsePath } from "@/lib/url";
import { SECTOR } from "@/lib/org";
import { translator, type Language } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { listSectors } from "@/lib/sectors";
import { listCompanies } from "@/lib/companies";
import { buildCompanyMonthlySeries, listSubsidiaryMonthlyBudgetRevenue, listSubsidiaryMonthlyRevenue } from "@/lib/group-revenue";
import { Drill } from "@/components/Drill";
import { CompareChart } from "@/components/charts";
import { MonthSelect } from "@/components/MonthSelect";
import { YearSelect } from "@/components/YearSelect";
import { Delta, Insights, Kpi, NotConnected, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Sales · One Transind" };
type Params = Promise<{ m?: string; year?: string; p?: string; s?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={4} hasFilters panels={2} />}><Content searchParams={searchParams} /></Suspense>;
}

const M = (x: number) => x / 1e6;

function PanelSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="panel c12" aria-busy="true" style={{ minHeight: height, display: "grid", gap: 14, alignContent: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="skeleton" style={{ width: 180, height: 18 }} />
        <div className="skeleton" style={{ width: 90, height: 14 }} />
      </div>
      <div className="skeleton" style={{ width: "100%", height: Math.max(80, height - 64) }} />
    </div>
  );
}

function PaceCells({ pace }: { pace: Omit<ManagerTrackingRow, "manager"> }) {
  return (
    <>
      <td className="n num">{pace.target ? fmt(pace.target) : "—"}</td><td className="n num">{fmt(pace.sales)}</td>
      <td className="n num">{pace.achievedPct === null ? "—" : `${fmt(pace.achievedPct, 1)}%`}</td><td className="n num">{pace.target ? fmt(pace.balance) : "—"}</td>
      <td className="n num">{pace.dailyRequired === null ? "—" : fmt(pace.dailyRequired)}</td><td className="n num">{pace.projectedPct === null ? "—" : `${fmt(pace.projectedPct, 1)}%`}</td>
    </>
  );
}

type InsightContext = { mn: string; years: number[]; ytd: number; ytdL: number; g25: number[] };

function buildSalesInsights(rows: DrillRow[], { mn, years, ytd, ytdL, g25 }: InsightContext): [string, string][] {
  const grow = rows.filter((r) => r.lastYear).map((r) => ({ ...r, g: pct(r.value, r.lastYear) })).sort((a, b) => b.g - a.g);
  const topBrand = rows[0];
  const peak = g25.indexOf(Math.max(...g25));
  const out: [string, string][] = [];
  if (grow.length > 1) {
    out.push(["good", `${grow[0].label} grew fastest in ${mn}: ${fmt(grow[0].g, 1)}% vs ${years[1]}.`]);
    const w = grow[grow.length - 1];
    out.push(w.g < 0 ? ["bad", `${w.label} declined most in ${mn}: ${fmt(Math.abs(w.g), 1)}% vs ${years[1]}.`] : ["plain", `No decline in ${mn}: every line is at or above ${years[1]}.`]);
  }
  const totalValue = sum(rows.map((r) => r.value));
  if (topBrand) out.push(["plain", `${topBrand.label} is the largest line in ${mn} with ${fmt(totalValue ? topBrand.value / totalValue * 100 : 0, 1)}% of sales.`]);
  out.push(["plain", `Year to date ${fmt(ytd, 1)} M, ${fmt(pct(ytd, ytdL), 1)}% vs the same months of ${years[1]}.`]);
  if (g25[peak]) out.push(["plain", `${MONTHS[peak]} was the strongest month of ${years[1]} with ${fmt(g25[peak], 1)} M.`]);
  return out;
}

async function ErpDrillPanel({
  drillPromise,
  groupSectorLabel,
  title,
  urlPath,
  levels,
  rootLabel,
  showAll,
  yoyLabels,
  view,
  sector,
}: {
  drillPromise: Promise<[DrillRow[], string[]]>;
  groupSectorLabel?: string;
  title: string;
  urlPath: string[];
  levels: string[];
  rootLabel: string;
  showAll: boolean;
  yoyLabels: [string, string];
  view: { year: string; m: string };
  sector: string;
}) {
  const [rows, labels] = await drillPromise;
  const drillLabels = groupSectorLabel ? [groupSectorLabel, ...labels] : labels;
  return (
    <Drill
      title={title}
      mode="yoy"
      rows={rows}
      labels={drillLabels}
      path={urlPath}
      levels={levels}
      rootLabel={rootLabel}
      all={showAll}
      yoyLabels={yoyLabels}
      href={(pp, a) => link("/sales", { ...view, p: pp.join("|"), s: sector, all: a ? "1" : undefined })}
    />
  );
}

async function ErpInsightsPanel({
  drillPromise,
  title,
  context,
}: {
  drillPromise: Promise<[DrillRow[], string[]]>;
  title: string;
  context: InsightContext;
}) {
  const [rows] = await drillPromise;
  return <Insights title={title} items={buildSalesInsights(rows, context)} />;
}

async function ManagerTargetsPanel({
  periodIso,
  monthLabel,
  language,
}: {
  periodIso: string;
  monthLabel: string;
  language: Language;
}) {
  const tracking = await getManagerTracking(periodIso).catch(() => null); // the ERP view only exists on the live server
  if (!tracking || !tracking.rows.some((r) => r.target > 0)) return null;
  const translate = translator(language);
  return (
    <Panel span={12} title={`${translate("Manager targets")} · ${monthLabel}`}>
      <div className="tw"><table className="sticky-col">
        <thead><tr><th>{translate("Manager")}</th><th className="n">{translate("Target")}</th><th className="n">{translate("Sales")}</th><th className="n">%</th><th className="n">{translate("Balance")}</th><th className="n">{translate("Daily balance required")}</th><th className="n">{translate("Projected %")}</th></tr></thead>
        <tbody>{tracking.rows.map((r) => <tr key={r.manager}><td>{r.manager}</td><td className="n num">{r.target ? fmt(r.target) : "—"}</td><td className="n num">{fmt(r.sales)}</td><td className="n num">{r.achievedPct === null ? "—" : `${fmt(r.achievedPct, 1)}%`}</td><td className="n num">{r.target ? fmt(r.balance) : "—"}</td><td className="n num">{r.dailyRequired === null ? "—" : fmt(r.dailyRequired)}</td><td className="n num">{r.projectedPct === null ? "—" : `${fmt(r.projectedPct, 1)}%`}</td></tr>)}</tbody>
      </table></div>
      <p className="note" style={{ marginTop: 8 }}>QAR. Sales through {tracking.throughDate}; {tracking.daysGone} of {tracking.workingDays} working days gone, {tracking.daysLeft} left (Fridays off). Daily balance required = balance ÷ working days left. Projected % = current daily pace over the full month.</p>
    </Panel>
  );
}

async function SalesmanTargetsPanel({
  periodIso,
  monthLabel,
  language,
}: {
  periodIso: string;
  monthLabel: string;
  language: Language;
}) {
  const salesmanTracking = await getSalesmanTracking(periodIso).catch(() => null);
  if (!salesmanTracking || !salesmanTracking.supervisors.some((s) => s.total.target > 0)) return null;
  const translate = translator(language);
  return (
    <Panel span={12} title={`${translate("Salesman targets by supervisor")} · ${monthLabel}`}>
      <div className="tw"><table className="sticky-col">
        <thead><tr><th>{translate("Supervisor / salesman")}</th><th>{translate("Channel")}</th><th className="n">{translate("Target")}</th><th className="n">{translate("Sales")}</th><th className="n">%</th><th className="n">{translate("Balance")}</th><th className="n">{translate("Daily balance required")}</th><th className="n">{translate("Projected %")}</th></tr></thead>
        {salesmanTracking.supervisors.map((s) => (
          <tbody key={s.supervisor}>
            <tr style={{ fontWeight: 600 }}><td>{s.supervisor}</td><td /><PaceCells pace={s.total} /></tr>
            {s.salesmen.map((r) => <tr key={`${r.code}|${r.channel}|${r.department}`}><td style={{ paddingLeft: 20 }}>{r.salesman}</td><td>{[r.channel, r.department].filter(Boolean).join(" · ")}</td><PaceCells pace={r} /></tr>)}
          </tbody>
        ))}
      </table></div>
      <p className="note" style={{ marginTop: 8 }}>QAR. Same basis as the manager table above. Sales with no target set sit under their supervisor with no percentages; sales with no supervisor are under Unassigned.</p>
    </Panel>
  );
}

async function SectorIndicatorsPanel({
  periodIso,
  month,
  pick,
  year,
  dept,
  deptLabel,
  sectorCodes,
  language,
}: {
  periodIso: string;
  month: number;
  pick: MonthPick;
  year: number;
  dept: string;
  deptLabel: string;
  sectorCodes: string[];
  language: Language;
}) {
  const translate = translator(language);
  const [indicatorRows, computedIndicators, returns] = await Promise.all([
    listSalesSectorIndicators(periodIso),
    getComputedSalesIndicators(month, dept, deptLabel),
    getSalesReturns(pick, dept ? [dept] : sectorCodes, year),
  ]);
  const indicators = mergeSalesSectorIndicators(computedIndicators, resolveSectorIndicators(indicatorRows, dept));
  const indMoney = (v: number | undefined) => (v !== undefined ? money(v) : undefined);
  const indPct = (v: number | undefined) => (v !== undefined ? `${fmt(v, 1)}%` : undefined);
  const sectorKpis: [string, string?][] = [
    ["Van sales", indMoney(indicators.get("van_sales"))],
    ["Key accounts", indMoney(indicators.get("key_accounts"))],
    ["HORECA", indMoney(indicators.get("horeca"))],
    ["Wholesale", indMoney(indicators.get("wholesale"))],
    ["Returns rate", `${fmt(returns.sales ? -returns.creditNotes / returns.sales * 100 : 0, 1)}%`],
    ["Out-of-stock loss", indMoney(indicators.get("out_of_stock_loss"))],
    ["Price realisation", indPct(indicators.get("price_realisation"))],
    ["Promo uplift", indPct(indicators.get("promo_uplift"))],
  ];
  return (
    <Panel span={12} title={`${translate("Sector indicators")} · ${dept ? deptLabel : translate("All")}`}>
      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
        {sectorKpis.map(([l, v]) => <div className="kpi" key={l} style={{ padding: "10px 12px" }}><span className="l">{translate(l)}</span><span className="v" style={{ fontSize: 20 }}>{v ?? <NotConnected />}</span></div>)}
      </div>
    </Panel>
  );
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const [, language, { m, year: rawYear, p, s: sector = "", all }] = await Promise.all([
    requireUser("sales"),
    getLanguage(),
    searchParams,
  ]);
  const translate = translator(language);

  // Without an admin sales sector the page is the group view: the first path step is a group sector, and inside Trading the rest is the ERP department drill.
  const fullPath = parsePath(p), groupMode = !sector, groupSector = groupMode ? (fullPath[0] ?? "") : "";
  const path = groupMode ? (groupSector === SECTOR.trading ? fullPath.slice(1) : []) : fullPath, dept = path[0] ?? "";
  const showGroup = groupMode && !dept && !groupSector;
  const otherSector = groupMode && !dept && groupSector !== "" && groupSector !== SECTOR.trading; // a non-Trading sector: its companies' reported revenue, no ERP

  const [o, allDepartments, groupSectors, groupCompanies, earlyHist] = await Promise.all([
    getOverview(),
    otherSector ? Promise.resolve([]) : getSalesSectors(),
    groupMode ? listSectors() : Promise.resolve([] as [string, string][]),
    groupMode ? listCompanies() : Promise.resolve([]),
    groupMode ? getMonthly(dept ? [dept] : []) : Promise.resolve(null),
  ]);

  // A sector (set in admin) is a group of departments: its page shows only those departments.
  const sectors = sector ? allDepartments.filter((d) => d.sector === sector) : allDepartments;
  const sectorCodes = sector ? sectors.map((d) => d.key) : [];
  if (sector && !sectors.length) return <p className="empty">No departments are assigned to this sector yet. Assign them in Admin → Sales sectors.</p>; // else the empty list would mean "all"

  const yearList = [o.year - 2, o.year - 1, o.year];
  const year = yearList.find((y) => String(y) === rawYear) ?? o.year;
  const years = [year - 2, year - 1, year];
  const maxMonth = year === o.year ? o.month : 11; // the latest month with data in the chosen year
  const rawM = Number(m);
  const allMonths = m === "all";
  // The period is the months `from`..`month` of the chosen year: one month or the whole year (to the latest month). `month` is its last month, where year-to-date stops.
  const month = allMonths ? maxMonth : Math.min(maxMonth, Math.max(0, m && Number.isInteger(rawM) && rawM >= 1 ? rawM - 1 : maxMonth));
  const from = allMonths ? 0 : month;
  const pick: MonthPick = allMonths ? "all" : month;
  const urlPath = groupMode ? fullPath : path;
  const deptLabel = dept ? (sectors.find((s) => s.key === dept)?.label ?? dept) : "";
  const periodIso = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // Group total: ERP sales are Trading and Distribution; every other sector's revenue comes from the company reports (same source as the dashboard).
  // On the "All" view the cards, chart and targets use the group figures; a sector or department page stays ERP-only.
  const [hist, groupRows, groupBudget, deptTargets] = await Promise.all([
    earlyHist ? Promise.resolve(earlyHist) : getMonthly(dept ? [dept] : sectorCodes),
    groupMode ? listSubsidiaryMonthlyRevenue(years) : Promise.resolve([]),
    showGroup ? listSubsidiaryMonthlyBudgetRevenue(year) : Promise.resolve([]),
    otherSector ? Promise.resolve([]) : listEffectiveDepartmentTargets(year),
  ]);

  const erpAt = (y: number, i: number) => hist.find((h) => h.year === y && h.month === i + 1)?.value ?? 0;
  const sectorAt = (key: string) => {
    const cos = groupCompanies.filter((c) => c.sector === key && c.active && !c.hidden);
    return (y: number, i: number) => key === SECTOR.trading ? erpAt(y, i) : sum(cos.map((c) => buildCompanyMonthlySeries(groupRows, c.id, y)[i]));
  };
  const spanOf = (at: (y: number, i: number) => number, y: number) => sum(Array.from({ length: month - from + 1 }, (_, i) => at(y, from + i)));
  const groupLines = groupSectors.map(([key, name]) => {
    const at = sectorAt(key);
    const ytdOf = (y: number) => sum(Array.from({ length: month + 1 }, (_, i) => at(y, i)));
    return { key, name, month: spanOf(at, year), lastYearMonth: spanOf(at, year - 1), ytd: ytdOf(year), lastYearYtd: ytdOf(year - 1) };
  }).filter((l) => l.month || l.lastYearMonth || l.ytd || l.lastYearYtd).sort((a, b) => b.month - a.month);
  const groupTotal = { month: sum(groupLines.map((l) => l.month)), lastYearMonth: sum(groupLines.map((l) => l.lastYearMonth)), ytd: sum(groupLines.map((l) => l.ytd)), lastYearYtd: sum(groupLines.map((l) => l.lastYearYtd)) };
  const rowOf = (key: string, label: string, at: (y: number, i: number) => number): DrillRow => ({ key, label, sub: "", value: spanOf(at, year), lastMonth: spanOf(at, year - 1), lastYear: spanOf(at, year - 1), twoYearsAgo: spanOf(at, year - 2), cost: 0, units: 0 });
  const companySales = (id: number) => (y: number, i: number) => buildCompanyMonthlySeries(groupRows, id, y)[i];

  const isErpDrill = !groupMode || groupSector === SECTOR.trading;
  const erpDrillPromise: Promise<[DrillRow[], string[]]> | null = isErpDrill
    ? Promise.all([
        getDrill(pick, "p", path, path.length ? [] : sectorCodes, year),
        path.length ? getDrillLabels(pick, "p", path) : Promise.resolve([] as string[]),
      ])
    : null;
  const groupDrillRows: DrillRow[] = isErpDrill
    ? []
    : groupSector
      ? groupCompanies.filter((c) => c.sector === groupSector && c.active && !c.hidden).map((c) => rowOf(String(c.id), c.name, companySales(c.id))).sort((a, b) => b.value - a.value)
      : groupLines.map((l) => rowOf(l.key, l.name, sectorAt(l.key))).sort((a, b) => b.value - a.value);
  const groupSectorName = groupSector ? (groupSectors.find(([k]) => k === groupSector)?.[1] ?? groupSector) : undefined;
  const drillLevels = (groupSector && groupSector !== SECTOR.trading ? ["Sectors", "Companies"] : ["Sectors", "Departments", "Brands", "Products"]).map((level) => translate(level));

  const groupAt = (y: number, i: number) => sum(groupLines.map((l) => sectorAt(l.key)(y, i)));
  const val = (y: number, i: number) => (y === o.year && i > o.month ? null : showGroup ? groupAt(y, i) : otherSector ? sectorAt(groupSector)(y, i) : erpAt(y, i));
  const series = years.map((y) => Array.from({ length: 12 }, (_, i) => { const v = val(y, i); return v == null ? null : M(v); }));
  const [g24, g25, g26] = series.map((s) => s.map((v) => v ?? 0));
  const ytd = sum(g26.slice(0, month + 1)), ytdL = sum(g25.slice(0, month + 1));
  const spanG = (a: number[]) => sum(a.slice(from, month + 1));
  const [cur, prev, prev2] = [g26, g25, g24].map(spanG);
  const mn = allMonths ? `${MONTHS[0]}–${MONTHS[month]}` : MONTHS[month], upTo = !allMonths && year === o.year && month === o.month ? ` (1–${o.day})` : ""; // the month still running is counted up to the latest data day, and so are its comparisons
  const mParam = allMonths ? "all" : String(month + 1), view = { year: String(year), m: mParam };
  const q = (patch: Record<string, string | undefined>) => link("/sales", { ...view, p: urlPath.join("|"), s: sector, ...patch });

  const relevantCodes = dept ? new Set([dept]) : new Set(sectors.map((s) => s.key));
  const monthTargetRows = deptTargets.filter((t) => t.month >= from && t.month <= month && relevantCodes.has(t.code));
  const erpTargetQar = monthTargetRows.length ? sum(monthTargetRows.map((t) => t.target)) : 0;
  const groupTargetQar = showGroup ? erpTargetQar + spanG(groupBudget) : 0;
  const targetMonthQar = (showGroup ? groupTargetQar : otherSector ? 0 : erpTargetQar) || null; // no per-sector budget split exists for the other sectors
  const attainment = computeTargetAttainment(cur * 1e6, targetMonthQar);

  const insightContext: InsightContext = { mn, years, ytd, ytdL, g25 };
  const showTracking = !dept && !sector && !otherSector && year === o.year;
  const showIndicators = year === o.year && !otherSector && Boolean(dept || !sector);
  const currentMonthLabel = `${MONTHS[o.month]} ${o.year}`;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <YearSelect years={yearList} value={year} base={link("/sales", { m: mParam, p: urlPath.join("|"), s: sector })} />
        <MonthSelect value={allMonths ? "all" : month} allLabel="All months" max={maxMonth} names={MONTHS} base={link("/sales", { year: view.year, p: urlPath.join("|"), s: sector })} />
        <div className="tabs">
          <Link href={link("/sales", { ...view, s: sector })} aria-pressed={groupMode ? !groupSector : !dept}>{translate("All")}</Link>
          {groupMode
            ? groupLines.map((l) => <Link key={l.key} href={link("/sales", { ...view, p: l.key })} aria-pressed={groupSector === l.key}>{l.name}</Link>)
            : sectors.map((s) => <Link key={s.key} href={link("/sales", { ...view, p: s.key, s: sector })} aria-pressed={dept === s.key}>{s.label}</Link>)}
        </div>
      </div>
      <div className="kpis">
        <Kpi label={`${translate("Sales")} ${mn}${upTo}`} value={`${fmt(cur, 2)} M`} delta={<><Delta a={cur} b={prev} /> {translate("vs")} {mn} {years[1]}</>} spark={g26.slice(0, maxMonth + 1)} />
        <Kpi label={`${translate("vs")} ${mn} ${years[0]}`} value={`${fmt(prev2, 2)} M`} delta={<Delta a={cur} b={prev2} />} spark={g24} />
        <Kpi label={translate("Year to date")} value={`${fmt(ytd, 1)} M`} delta={<><Delta a={ytd} b={ytdL} /> {translate("vs same period last year")}</>} spark={g26.slice(0, month + 1)} />
        <Kpi
          label={translate("Target attainment")}
          value={attainment !== null ? `${fmt(attainment, 1)}%` : <NotConnected />}
          delta={targetMonthQar !== null ? `${translate("Target")} ${fmt(M(targetMonthQar), 2)} M` : undefined}
          up={attainment !== null ? attainment >= 100 : undefined}
        />
      </div>
      <div className="grid">
        {showGroup && groupLines.length > 0 && (
          <Panel span={12} title={`${translate("Group total")} · ${mn} ${year}`}>
            <div className="tw"><table className="sticky-col">
              <thead><tr><th>{translate("Sector")}</th><th className="n">{mn}{upTo}</th><th className="n">{translate("vs")} {years[1]}</th><th className="n">{translate("Year to date")}</th><th className="n">{translate("vs")} {years[1]}</th></tr></thead>
              <tbody>
                {groupLines.map((l) => <tr key={l.name}><td>{l.name}</td><td className="n num">{fmt(l.month)}</td><td className="n num"><Delta a={l.month} b={l.lastYearMonth} /></td><td className="n num">{fmt(l.ytd)}</td><td className="n num"><Delta a={l.ytd} b={l.lastYearYtd} /></td></tr>)}
                <tr style={{ fontWeight: 600 }}><td>{translate("Group total")}</td><td className="n num">{fmt(groupTotal.month)}</td><td className="n num"><Delta a={groupTotal.month} b={groupTotal.lastYearMonth} /></td><td className="n num">{fmt(groupTotal.ytd)}</td><td className="n num"><Delta a={groupTotal.ytd} b={groupTotal.lastYearYtd} /></td></tr>
              </tbody>
            </table></div>
            <p className="note" style={{ marginTop: 8 }}>QAR. Trading and Distribution is ERP sales; other sectors are the revenue their companies report (Admin → Finance). The cards, monthly chart and target attainment are group figures; the breakdown, manager targets and indicators below are ERP sales only.</p>
          </Panel>
        )}
        <Panel span={12} title={`${translate("Monthly comparison")}: ${years[2]} vs ${years[1]} and ${years[0]}${dept ? " · " + deptLabel : groupSectorName ? " · " + groupSectorName : ""}`}>
          <CompareChart years={years} series={series} sel={month} href={(i) => q({ m: String(i + 1) })} />
          {year === o.year && <p className="note" style={{ marginTop: 8 }}>{MONTHS[o.month]} {o.year} has data for days 1–{o.day} only; every other bar is a full month.</p>}
        </Panel>
        {erpDrillPromise ? (
          <Suspense fallback={<PanelSkeleton height={260} />}>
            <ErpDrillPanel
              drillPromise={erpDrillPromise}
              groupSectorLabel={groupSectorName}
              title={`${translate("Sales breakdown")} · ${mn} ${year}`}
              urlPath={urlPath}
              levels={drillLevels}
              rootLabel={translate("All")}
              showAll={all === "1"}
              yoyLabels={[`${mn} ${years[1]}`, `${mn} ${years[0]}`]}
              view={view}
              sector={sector}
            />
          </Suspense>
        ) : (
          <Drill
            title={`${translate("Sales breakdown")} · ${mn} ${year}`}
            mode="yoy"
            rows={groupDrillRows}
            labels={groupSectorName ? [groupSectorName] : []}
            path={urlPath}
            levels={drillLevels}
            rootLabel={translate("All")}
            all={all === "1"}
            yoyLabels={[`${mn} ${years[1]}`, `${mn} ${years[0]}`]}
            href={(pp, a) => link("/sales", { ...view, p: pp.join("|"), s: sector, all: a ? "1" : undefined })}
          />
        )}
        {showTracking && (
          <Suspense fallback={null}>
            <ManagerTargetsPanel periodIso={periodIso} monthLabel={currentMonthLabel} language={language} />
          </Suspense>
        )}
        {showTracking && (
          <Suspense fallback={null}>
            <SalesmanTargetsPanel periodIso={periodIso} monthLabel={currentMonthLabel} language={language} />
          </Suspense>
        )}
        {erpDrillPromise ? (
          <Suspense fallback={<PanelSkeleton height={150} />}>
            <ErpInsightsPanel drillPromise={erpDrillPromise} title={translate("Analysis")} context={insightContext} />
          </Suspense>
        ) : (
          <Insights title={translate("Analysis")} items={buildSalesInsights(groupDrillRows, insightContext)} />
        )}
        {showIndicators && (
          <Suspense fallback={<PanelSkeleton height={160} />}>
            <SectorIndicatorsPanel
              periodIso={periodIso}
              month={month}
              pick={pick}
              year={year}
              dept={dept}
              deptLabel={deptLabel}
              sectorCodes={sectorCodes}
              language={language}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
