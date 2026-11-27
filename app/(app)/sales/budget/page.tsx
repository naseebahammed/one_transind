import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, money } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { listBrandMonthTotals, listBrandYearPlans } from "@/lib/brand-budget-records";
import { YearSelect } from "@/components/YearSelect";
import { Kpi, MonthBars, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Brand budget · One Transind" };
type Params = Promise<{ year?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={4} hasFilters panels={1} />}><Content searchParams={searchParams} /></Suspense>;
}

// Cost of goods is stored negative, so gross profit is target plus cost. Growth and margin are worked out here, never stored.
async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("sales");
  const translate = translator(await getLanguage());
  const all = await listBrandYearPlans();
  const years = [...new Set(all.map((r) => r.year))].sort((a, b) => b - a);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : years[0];
  if (year === undefined) return <p className="empty">No brand budget uploaded yet. Upload it under Admin, Company finance.</p>;
  const rows = all.filter((r) => r.year === year);
  const monthly = await listBrandMonthTotals(year);
  const target = rows.reduce((a, r) => a + r.target, 0), forecast = rows.reduce((a, r) => a + (r.forecast ?? 0), 0), cost = rows.reduce((a, r) => a + (r.cogs ?? 0), 0);
  const profit = target + cost;
  const pctOf = (part: number, whole: number) => (whole ? `${fmt((part / whole) * 100, 1)}%` : "—");
  const monthSeries = Array.from({ length: 12 }, (_, i) => monthly.filter((m) => m.month === i + 1).reduce((a, m) => a + m.amount, 0));

  return (
    <>
      <p><Link href="/sales">{translate("‹ Sales")}</Link></p>
      <YearSelect years={years} value={year} base="/sales/budget" />
      <div className="kpis">
        <Kpi label={`${translate("Sales target")} ${year}`} value={`${money(target)} QAR`} />
        <Kpi label={`${translate("Forecast")} ${year - 1}`} value={`${money(forecast)} QAR`} delta={forecast ? `${fmt(((target - forecast) / forecast) * 100, 1)}% ${translate("growth")}` : undefined} />
        <Kpi label={translate("Gross profit")} value={`${money(profit)} QAR`} />
        <Kpi label={translate("Gross margin")} value={pctOf(profit, target)} />
      </div>
      <div className="grid">
        {monthly.length > 0 && <Panel span={12} title={`${translate("Monthly plan")} · ${year}`} src={translate("QAR, all brands")}><MonthBars series={[monthSeries]} labels={[translate("Plan")]} /></Panel>}
        <section className="panel c12">
          <header><h2>{translate("By brand")}</h2></header>
          <div className="tw scroll"><table>
            <thead><tr><th>{translate("Brand")}</th><th>{year - 2} {translate("actual")}</th><th>{year - 1} {translate("forecast")}</th><th>{year} {translate("target")}</th><th>{translate("Growth")}</th><th>{translate("Gross profit")}</th><th>{translate("Margin")}</th></tr></thead>
            <tbody>{rows.map((r) => {
              const brandProfit = r.cogs === null ? null : r.target + r.cogs;
              return <tr key={r.brand}><td>{r.brand}</td><td>{r.priorActual === null ? "—" : fmt(r.priorActual)}</td><td>{r.forecast === null ? "—" : fmt(r.forecast)}</td><td>{fmt(r.target)}</td>
                <td>{r.forecast ? pctOf(r.target - r.forecast, r.forecast) : "—"}</td><td>{brandProfit === null ? "—" : fmt(brandProfit)}</td><td>{brandProfit === null ? "—" : pctOf(brandProfit, r.target)}</td></tr>;
            })}</tbody>
          </table></div>
        </section>
      </div>
    </>
  );
}
