import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, MONTHS, money } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { listPosMonths, type PosMonth } from "@/lib/pos-reports-records";
import { YearSelect } from "@/components/YearSelect";
import { Kpi } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "POS reports · One Transind" };
type Params = Promise<{ year?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={4} hasFilters panels={1} />}><Content searchParams={searchParams} /></Suspense>;
}

const title = (entity: string) => entity.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const sumOf = (rows: PosMonth[], pick: (row: PosMonth) => number | null) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
const cell = (value: number | null) => (value === null ? "—" : fmt(value));

// A figure shown as "—" means that report was not loaded for the month; it is not a zero. Margin is item sales minus cost; stock is the cost value at the end of the report's month.
async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("retail");
  const translate = translator(await getLanguage());
  const all = await listPosMonths();
  const years = [...new Set(all.map((r) => Number(r.period.slice(0, 4))))].sort((a, b) => b - a);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : years[0];
  if (year === undefined) return <p className="empty">No POS reports uploaded yet. Upload them under Admin, Company finance.</p>;
  const rows = all.filter((r) => Number(r.period.slice(0, 4)) === year);
  const entities = [...new Set(rows.map((r) => r.entity))];

  return (
    <>
      <p><Link href="/retail">{translate("‹ Hypermarkets & Retail")}</Link></p>
      <YearSelect years={years} value={year} base="/retail/pos" />
      {entities.map((entity) => {
        const mine = rows.filter((r) => r.entity === entity), net = sumOf(mine, (r) => (r.sales ?? 0) + (r.returns ?? 0)), margin = sumOf(mine, (r) => (r.itemSales ?? 0) - (r.itemCost ?? 0)), itemSales = sumOf(mine, (r) => r.itemSales);
        const latest = [...mine].reverse().find((r) => r.stockCost !== null);
        return (
          <section key={entity} className="panel">
            <header><h2>{title(entity)} · {year}</h2></header>
            <div className="kpis">
              <Kpi label={translate("Net sales")} value={`${money(net)} QAR`} />
              <Kpi label={translate("Gross margin")} value={itemSales ? `${fmt((margin / itemSales) * 100, 1)}%` : "—"} />
              <Kpi label={translate("Purchases")} value={`${money(sumOf(mine, (r) => r.purchases))} QAR`} />
              <Kpi label={translate("Stock at cost")} value={latest ? `${money(latest.stockCost ?? 0)} QAR` : "—"} delta={latest ? MONTHS[Number(latest.period.slice(5, 7)) - 1] : undefined} />
            </div>
            <div className="tw scroll"><table>
              <thead><tr><th>{translate("Month")}</th><th>{translate("Sales")}</th><th>{translate("Returns")}</th><th>{translate("Gross margin")}</th><th>{translate("Purchases")}</th><th>{translate("Stock at cost")}</th></tr></thead>
              <tbody>{mine.map((r) => <tr key={r.period}><td>{MONTHS[Number(r.period.slice(5, 7)) - 1]}</td><td>{cell(r.sales)}</td><td>{cell(r.returns)}</td>
                <td>{r.itemSales === null || r.itemCost === null ? "—" : fmt(r.itemSales - r.itemCost)}</td><td>{cell(r.purchases)}</td><td>{cell(r.stockCost)}</td></tr>)}</tbody>
            </table></div>
          </section>
        );
      })}
    </>
  );
}
