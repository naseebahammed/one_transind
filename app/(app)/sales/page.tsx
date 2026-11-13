import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getBreakdown, getDrill, getDrillLabels, getMonthly, getOverview, type DrillRow, type MonthPick } from "@/lib/data";
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
import { listSectors } from "@/lib/sectors";
import { listCompanies } from "@/lib/companies";
import { buildCompanyMonthlySeries, listSubsidiaryMonthlyBudgetRevenue, listSubsidiaryMonthlyRevenue } from "@/lib/group-revenue";
import { Drill } from "@/components/Drill";
import { CompareChart } from "@/components/charts";
import { MonthSelect } from "@/components/MonthSelect";
import { QuarterSelect } from "@/components/QuarterSelect";
import { YearSelect } from "@/components/YearSelect";
import { Delta, Insights, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Sales · One Transind" };
type Params = Promise<{ m?: string; qt?: string; year?: string; p?: string; s?: string; all?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const M = (x: number) => x / 1e6;

function PaceCells({ pace }: { pace: Omit<ManagerTrackingRow, "manager"> }) {
  return (
    <>
      <td className="n num">{pace.target ? fmt(pace.target) : "—"}</td><td className="n num">{fmt(pace.sales)}</td>
      <td className="n num">{pace.achievedPct === null ? "—" : `${fmt(pace.achievedPct, 1)}%`}</td><td className="n num">{pace.target ? fmt(pace.balance) : "—"}</td>
      <td className="n num">{pace.dailyRequired === null ? "—" : fmt(pace.dailyRequired)}</td><td className="n num">{pace.projectedPct === null ? "—" : `${fmt(pace.projectedPct, 1)}%`}</td>
    </>
  );
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const [{ m, qt, year: rawYear, p, s: sector = "", all }, o, allDepartments] = await Promise.all([searchParams, getOverview(), getSalesSectors()]);
  const yearList = [o.year - 2, o.year - 1, o.year];
  const year = yearList.find((y) => String(y) === rawYear) ?? o.year;
  const maxMonth = year === o.year ? o.month : 11; // the latest month with data in the chosen year
  const rawQ = Number(qt), quarter = Number.isInteger(rawQ) && rawQ >= 1 && rawQ <= 4 && (rawQ - 1) * 3 <= maxMonth ? rawQ : 0;
  const rawM = Number(m);
  const allMonths = !quarter && m === "all";
  // The period is the months `from`..`month` of the chosen year: one month, a quarter or the whole year (to the latest month). `month` is its last month, where year-to-date stops.
  const month = quarter ? Math.min((quarter - 1) * 3 + 2, maxMonth) : allMonths ? maxMonth : Math.min(maxMonth, Math.max(0, m && Number.isInteger(rawM) && rawM >= 1 ? rawM - 1 : maxMonth));
  const from = quarter ? (quarter - 1) * 3 : allMonths ? 0 : month;
  const pick: MonthPick = quarter ? (`q${quarter}` as MonthPick) : allMonths ? "all" : month;
  // A sector (set in admin) is a group of departments: its page shows only those departments.
  const sectors = sector ? allDepartments.filter((d) => d.sector === sector) : allDepartments;
  const sectorCodes = sector ? sectors.map((d) => d.key) : [];
  if (sector && !sectors.length) return <p className="empty">No departments are assigned to this sector yet. Assign them in Admin → Sales sectors.</p>; // else the empty list would mean "all"
  // Without an admin sales sector the page is the group view: the first path step is a group sector, and inside Trading the rest is the ERP department drill.
  const fullPath = parsePath(p), groupMode = !sector, groupSector = groupMode ? (fullPath[0] ?? "") : "";
  const path = groupMode ? (groupSector === SECTOR.trading ? fullPath.slice(1) : []) : fullPath, dept = path[0] ?? "";
  const urlPath = groupMode ? fullPath : path;
  const deptLabel = dept ? (sectors.find((s) => s.key === dept)?.label ?? dept) : "";
  const periodIso = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const [hist, top, subRows, labels, dep, deptTargets, indicatorRows, computedIndicators, tracking, salesmanTracking] = await Promise.all([
    getMonthly(dept ? [dept] : sectorCodes),
    getDrill(pick, "p", [], sectorCodes, year),
    path.length ? getDrill(pick, "p", path, [], year) : Promise.resolve(null),
    getDrillLabels(pick, "p", path),
    getBreakdown(pick, "dept", year),
    listEffectiveDepartmentTargets(year),
    listSalesSectorIndicators(periodIso),
    getComputedSalesIndicators(month, dept, deptLabel),
    getManagerTracking(periodIso).catch(() => null), // the ERP view only exists on the live server
    getSalesmanTracking(periodIso).catch(() => null),
  ]);
  const years = [year - 2, year - 1, year];

  // Group total: ERP sales are Trading and Distribution; every other sector's revenue comes from the company reports (same source as the dashboard).
  // On the "All" view the cards, chart and targets use the group figures; a sector or department page stays ERP-only.
  const showGroup = groupMode && !dept;
  const [groupSectors, groupCompanies, groupRows, groupBudget] = groupMode
    ? await Promise.all([listSectors(), listCompanies(), listSubsidiaryMonthlyRevenue(years), listSubsidiaryMonthlyBudgetRevenue(year)])
    : [[], [], [], []];
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
  const rows: DrillRow[] = !groupMode || groupSector === SECTOR.trading ? (subRows ?? top)
    : groupSector ? groupCompanies.filter((c) => c.sector === groupSector && c.active && !c.hidden).map((c) => rowOf(String(c.id), c.name, companySales(c.id))).sort((a, b) => b.value - a.value)
    : groupLines.map((l) => rowOf(l.key, l.name, sectorAt(l.key))).sort((a, b) => b.value - a.value);
  const drillLabels = groupSector ? [groupSectors.find(([k]) => k === groupSector)?.[1] ?? groupSector, ...labels] : labels;
  const drillLevels = groupSector && groupSector !== SECTOR.trading ? ["Sectors", "Companies"] : ["Sectors", "Departments", "Brands", "Products"];
  const groupAt = (y: number, i: number) => sum(groupLines.map((l) => sectorAt(l.key)(y, i)));
  const val = (y: number, i: number) => (y === o.year && i > o.month ? null : showGroup ? groupAt(y, i) : (erpAt(y, i)));
  const series = years.map((y) => Array.from({ length: 12 }, (_, i) => { const v = val(y, i); return v == null ? null : M(v); }));
  const [g24, g25, g26] = series.map((s) => s.map((v) => v ?? 0));
  const ytd = sum(g26.slice(0, month + 1)), ytdL = sum(g25.slice(0, month + 1));
  const spanG = (a: number[]) => sum(a.slice(from, month + 1));
  const [cur, prev, prev2] = [g26, g25, g24].map(spanG);
  const single = !quarter && !allMonths;
  const mn = quarter ? `Q${quarter}` : allMonths ? `${MONTHS[0]}–${MONTHS[month]}` : MONTHS[month], upTo = single && year === o.year && month === o.month ? ` (1–${o.day})` : ""; // the month still running is counted up to the latest data day, and so are its comparisons
  const mParam = quarter ? undefined : allMonths ? "all" : String(month + 1), view = { year: String(year), m: mParam, qt: quarter ? String(quarter) : undefined };
  const q = (patch: Record<string, string | undefined>) => link("/sales", { ...view, p: urlPath.join("|"), s: sector, ...patch });

  // analysis: growth by department (or by brand inside a department), peak season, YTD
  const grow = rows.filter((r) => r.lastYear).map((r) => ({ ...r, g: pct(r.value, r.lastYear) })).sort((a, b) => b.g - a.g);
  const topBrand = rows[0];
  const peak = g25.indexOf(Math.max(...g25));
  const out: [string, string][] = [];
  if (grow.length > 1) {
    out.push(["good", `${grow[0].label} grew fastest in ${mn}: ${fmt(grow[0].g, 1)}% vs ${years[1]}.`]);
    const w = grow[grow.length - 1];
    out.push(w.g < 0 ? ["bad", `${w.label} declined most in ${mn}: ${fmt(Math.abs(w.g), 1)}% vs ${years[1]}.`] : ["plain", `No decline in ${mn}: every line is at or above ${years[1]}.`]);
  }
  if (topBrand) out.push(["plain", `${topBrand.label} is the largest line in ${mn} with ${fmt(sum(rows.map((r) => r.value)) ? topBrand.value / sum(rows.map((r) => r.value)) * 100 : 0, 1)}% of sales.`]);
  out.push(["plain", `Year to date ${fmt(ytd, 1)} M, ${fmt(pct(ytd, ytdL), 1)}% vs the same months of ${years[1]}.`]);
  if (g25[peak]) out.push(["plain", `${MONTHS[peak]} was the strongest month of ${years[1]} with ${fmt(g25[peak], 1)} M.`]);

  const deptRow = dept ? top.find((r) => r.key === dept) : undefined;
  const credit = dept ? (dep.rows.find((r) => r.key === (deptRow?.label ?? dept))?.creditNotes ?? 0) : sum(dep.rows.map((r) => r.creditNotes));
  const sectorSales = dept ? (deptRow?.value ?? 0) : sum(top.map((r) => r.value));
  const relevantCodes = dept ? new Set([dept]) : new Set(sectors.map((s) => s.key));
  const monthTargetRows = deptTargets.filter((t) => t.month >= from && t.month <= month && relevantCodes.has(t.code));
  const targetSpan = (months: number[]) => spanG(months);
  const erpTargetQar = monthTargetRows.length ? sum(monthTargetRows.map((t) => t.target)) : 0;
  const groupTargetQar = showGroup ? erpTargetQar + targetSpan(groupBudget) : 0;
  const targetMonthQar = (showGroup ? groupTargetQar : erpTargetQar) || null;
  const attainment = computeTargetAttainment(cur * 1e6, targetMonthQar);
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
        <YearSelect years={yearList} value={year} base={link("/sales", { m: mParam, qt: view.qt, p: urlPath.join("|"), s: sector })} />
        <QuarterSelect value={quarter || ""} max={Math.floor(maxMonth / 3) + 1} base={link("/sales", { year: view.year, p: urlPath.join("|"), s: sector })} />
        <MonthSelect value={quarter ? "" : allMonths ? "all" : month} allLabel="All months" max={maxMonth} names={MONTHS} year={year} base={link("/sales", { year: view.year, p: urlPath.join("|"), s: sector })} />
        <div className="tabs">
          <Link href={link("/sales", { ...view, s: sector })} aria-pressed={groupMode ? !groupSector : !dept}>All</Link>
          {groupMode
            ? groupLines.map((l) => <Link key={l.key} href={link("/sales", { ...view, p: l.key })} aria-pressed={groupSector === l.key}>{l.name}</Link>)
            : sectors.map((s) => <Link key={s.key} href={link("/sales", { ...view, p: s.key, s: sector })} aria-pressed={dept === s.key}>{s.label}</Link>)}
        </div>
      </div>
      <div className="kpis">
        <Kpi label={`Sales ${mn}${upTo}`} value={`${fmt(cur, 2)} M`} delta={<><Delta a={cur} b={prev} /> vs {mn} {years[1]}</>} spark={g26.slice(0, maxMonth + 1)} />
        <Kpi label={`vs ${mn} ${years[0]}`} value={`${fmt(prev2, 2)} M`} delta={<Delta a={cur} b={prev2} />} spark={g24} />
        <Kpi label="Year to date" value={`${fmt(ytd, 1)} M`} delta={<><Delta a={ytd} b={ytdL} /> vs same period last year</>} spark={g26.slice(0, month + 1)} />
        <Kpi
          label="Target attainment"
          value={attainment !== null ? `${fmt(attainment, 1)}%` : <NotConnected />}
          delta={targetMonthQar !== null ? `Target ${fmt(M(targetMonthQar), 2)} M` : undefined}
          up={attainment !== null ? attainment >= 100 : undefined}
        />
      </div>
      <div className="grid">
        {showGroup && groupLines.length > 0 && (
          <Panel span={12} title={`Group total · ${mn} ${year}`}>
            <div className="tw"><table>
              <thead><tr><th>Sector</th><th className="n">{mn}{upTo}</th><th className="n">vs {years[1]}</th><th className="n">Year to date</th><th className="n">vs {years[1]}</th></tr></thead>
              <tbody>
                {groupLines.map((l) => <tr key={l.name}><td>{l.name}</td><td className="n num">{fmt(l.month)}</td><td className="n num"><Delta a={l.month} b={l.lastYearMonth} /></td><td className="n num">{fmt(l.ytd)}</td><td className="n num"><Delta a={l.ytd} b={l.lastYearYtd} /></td></tr>)}
                <tr style={{ fontWeight: 600 }}><td>Group total</td><td className="n num">{fmt(groupTotal.month)}</td><td className="n num"><Delta a={groupTotal.month} b={groupTotal.lastYearMonth} /></td><td className="n num">{fmt(groupTotal.ytd)}</td><td className="n num"><Delta a={groupTotal.ytd} b={groupTotal.lastYearYtd} /></td></tr>
              </tbody>
            </table></div>
            <p className="note" style={{ marginTop: 8 }}>QAR. Trading and Distribution is ERP sales; other sectors are the revenue their companies report (Admin → Finance). The cards, monthly chart and target attainment are group figures; the breakdown, manager targets and indicators below are ERP sales only.</p>
          </Panel>
        )}
        <Panel span={12} title={`Monthly comparison: ${years[2]} vs ${years[1]} and ${years[0]}${dept ? " · " + deptLabel : ""}`}>
          <CompareChart years={years} series={series} sel={month} href={(i) => q({ m: String(i + 1) })} />
          {year === o.year && <p className="note" style={{ marginTop: 8 }}>{MONTHS[o.month]} {o.year} has data for days 1–{o.day} only; every other bar is a full month.</p>}
        </Panel>
        <Drill
          title={`Sales breakdown · ${mn} ${year}`} mode="yoy" rows={rows} labels={drillLabels} path={urlPath}
          levels={drillLevels} rootLabel="All" all={all === "1"} yoyLabels={[`${mn} ${years[1]}`, `${mn} ${years[0]}`]}
          href={(pp, a) => link("/sales", { ...view, p: pp.join("|"), s: sector, all: a ? "1" : undefined })}
        />
        {!dept && !sector && year === o.year && tracking && tracking.rows.some((r) => r.target > 0) && (
          <Panel span={12} title={`Manager targets · ${MONTHS[o.month]} ${o.year}`}>
            <div className="tw"><table>
              <thead><tr><th>Manager</th><th className="n">Target</th><th className="n">Sales</th><th className="n">%</th><th className="n">Balance</th><th className="n">Daily balance required</th><th className="n">Projected %</th></tr></thead>
              <tbody>{tracking.rows.map((r) => <tr key={r.manager}><td>{r.manager}</td><td className="n num">{r.target ? fmt(r.target) : "—"}</td><td className="n num">{fmt(r.sales)}</td><td className="n num">{r.achievedPct === null ? "—" : `${fmt(r.achievedPct, 1)}%`}</td><td className="n num">{r.target ? fmt(r.balance) : "—"}</td><td className="n num">{r.dailyRequired === null ? "—" : fmt(r.dailyRequired)}</td><td className="n num">{r.projectedPct === null ? "—" : `${fmt(r.projectedPct, 1)}%`}</td></tr>)}</tbody>
            </table></div>
            <p className="note" style={{ marginTop: 8 }}>QAR. Sales through {tracking.throughDate}; {tracking.daysGone} of {tracking.workingDays} working days gone, {tracking.daysLeft} left (Fridays off). Daily balance required = balance ÷ working days left. Projected % = current daily pace over the full month.</p>
          </Panel>
        )}
        {!dept && !sector && year === o.year && salesmanTracking && salesmanTracking.supervisors.some((s) => s.total.target > 0) && (
          <Panel span={12} title={`Salesman targets by supervisor · ${MONTHS[o.month]} ${o.year}`}>
            <div className="tw"><table>
              <thead><tr><th>Supervisor / salesman</th><th>Channel</th><th className="n">Target</th><th className="n">Sales</th><th className="n">%</th><th className="n">Balance</th><th className="n">Daily balance required</th><th className="n">Projected %</th></tr></thead>
              {salesmanTracking.supervisors.map((s) => (
                <tbody key={s.supervisor}>
                  <tr style={{ fontWeight: 600 }}><td>{s.supervisor}</td><td /><PaceCells pace={s.total} /></tr>
                  {s.salesmen.map((r) => <tr key={`${r.code}|${r.channel}|${r.department}`}><td style={{ paddingLeft: 20 }}>{r.salesman}</td><td>{[r.channel, r.department].filter(Boolean).join(" · ")}</td><PaceCells pace={r} /></tr>)}
                </tbody>
              ))}
            </table></div>
            <p className="note" style={{ marginTop: 8 }}>QAR. Same basis as the manager table above. Sales with no target set sit under their supervisor with no percentages; sales with no supervisor are under Unassigned.</p>
          </Panel>
        )}
        <Insights title="Analysis" items={out} />
        {year === o.year && (dept || !sector) && <Panel span={12} title={`Sector indicators · ${dept ? deptLabel : "All"}`}>
          <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
            {sectorKpis.map(([l, v]) => <div className="kpi" key={l} style={{ padding: "10px 12px" }}><span className="l">{l}</span><span className="v" style={{ fontSize: 20 }}>{v ?? <NotConnected />}</span></div>)}
          </div>
        </Panel>}
      </div>
    </>
  );
}
