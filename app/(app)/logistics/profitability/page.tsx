import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, MONTHS, money } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { listProfitability } from "@/lib/profitability-records";
import { YearSelect } from "@/components/YearSelect";
import { Kpi } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Profitability · One Transind" };
type Params = Promise<{ year?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={4} hasFilters panels={1} />}><Content searchParams={searchParams} /></Suspense>;
}

// Margin is sales minus cost, worked out here and never stored. A margin of 0 on a thin month is a real zero, not missing data.
async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("logistics");
  const translate = translator(await getLanguage());
  const all = await listProfitability();
  const years = [...new Set(all.map((r) => r.year))].sort((a, b) => b - a);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : years[0];
  if (year === undefined) return <p className="empty">No profitability uploaded yet. Upload it under Admin, Company finance.</p>;
  const rows = all.filter((r) => r.year === year);
  const sales = rows.reduce((a, r) => a + r.sales, 0), cost = rows.reduce((a, r) => a + r.cost, 0), margin = sales - cost;
  const pctOf = (m: number, s: number) => (s ? `${fmt((m / s) * 100, 1)}%` : "—");

  return (
    <>
      <p><Link href="/logistics">{translate("‹ Logistics")}</Link></p>
      <YearSelect years={years} value={year} base="/logistics/profitability" />
      <div className="kpis">
        <Kpi label={`${translate("Sales")} ${year}`} value={`${money(sales)} QAR`} />
        <Kpi label={translate("Cost")} value={`${money(cost)} QAR`} />
        <Kpi label={translate("Margin")} value={`${money(margin)} QAR`} />
        <Kpi label={translate("Margin %")} value={pctOf(margin, sales)} />
      </div>
      <section className="panel">
        <header><h2>{translate("By month and business line")}</h2></header>
        <div className="tw scroll"><table>
          <thead><tr><th>{translate("Month")}</th><th>{translate("Line")}</th><th>{translate("Invoices")}</th><th>{translate("Sales (QAR)")}</th><th>{translate("Cost (QAR)")}</th><th>{translate("Margin (QAR)")}</th><th>{translate("Margin %")}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={`${r.month}-${r.line}`}><td>{MONTHS[r.month - 1]}</td><td>{r.line}</td><td>{fmt(r.invoices)}</td><td>{fmt(r.sales)}</td><td>{fmt(r.cost)}</td><td>{fmt(r.sales - r.cost)}</td><td>{pctOf(r.sales - r.cost, r.sales)}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
