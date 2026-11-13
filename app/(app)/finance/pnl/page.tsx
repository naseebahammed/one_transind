import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { fmt, MONTHS, sum } from "@/lib/format";
import { roundMoney } from "@/lib/money";
import { link } from "@/lib/url";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { keyFor, loadReports, plRows, report, years, type ReportRow } from "@/lib/reports";
import { listCompanies } from "@/lib/companies";
import { CompanySelect } from "@/components/CompanySelect";
import { YearSelect } from "@/components/YearSelect";
import { Kpi, Panel } from "@/components/ui";
import { PnlAccountTable } from "@/components/PnlAccountTable";
import Link from "next/link";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Monthly P&L · One Transind" };
type Params = Promise<{ company?: string; year?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={3} hasFilters panels={2} />}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection(); // statements can be uploaded at any time
  await requireUser("finance");
  const translate = translator(await getLanguage());
  const [reports, { company, year }, all] = await Promise.all([loadReports(), searchParams, listCompanies()]);
  const companies = all.filter((c) => c.active && !c.hidden && years(reports, keyFor(c)).length);
  // No (or unknown) choice means all companies.
  const selected = companies.find((c) => String(c.id) === company);
  if (!companies.length) return <p className="empty">No P&amp;L has been loaded for any company yet.</p>;
  const name = selected?.name ?? translate("All companies"), key = selected ? keyFor(selected) : companies.map(keyFor), ys = years(reports, key);
  const picked = ys.includes(Number(year)) ? Number(year) : ys.at(-1)!;
  const rows = plRows(reports, picked, key), summary = report(reports, picked, key);
  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) groups.set(r.main, [...(groups.get(r.main) ?? []), r]);
  // All companies: the same account appears once per company, so add them into one row per sub account.
  const bySub = (list: ReportRow[]) => [...list.reduce((by, r) => by.set(r.sub, (by.get(r.sub) ?? Array(12).fill(0)).map((v, i) => roundMoney(v + r.m[i]))), new Map<string, number[]>())].map(([sub, m]) => ({ sub, m }));
  const line = (label: string, m: number[], strong = false) => (
    <tr className={strong ? "tot" : undefined}><td>{label}</td>{m.map((v, i) => <td key={i} className={`n num${v < 0 ? " down" : ""}`}>{fmt(v)}</td>)}<td className={`n num${sum(m) < 0 ? " down" : ""}`}>{fmt(sum(m))}</td></tr>
  );
  const revenue = sum(summary.revenue), cost = sum(summary.totalCost), net = sum(summary.net);
  return (
    <div className="c12" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <CompanySelect companies={companies} value={selected?.id ?? "all"} base="/finance/pnl" allLabel={translate("All companies")} />
        <YearSelect years={ys} value={picked} base={link("/finance/pnl", { company: selected ? String(selected.id) : "all" })} />
        <Link href="/finance" className="btn primary" style={{ marginLeft: "auto", textDecoration: "none" }}>{translate("← Finance")}</Link>
      </div>
      <div className="kpis" style={{ marginBottom: 12 }}>
        <Kpi label={`${translate("Revenue")} ${picked}`} value={`${fmt(revenue / 1e6, 2)} M`} />
        <Kpi label={`${translate("Total cost")} ${picked}`} value={`${fmt(cost / 1e6, 2)} M`} />
        <Kpi label={translate("Net profit / loss")} value={`${fmt(net / 1e6, 2)} M`} delta={revenue ? `${fmt((net / revenue) * 100, 1)}% ${translate("of revenue")}` : undefined} up={net >= 0} />
      </div>
      <Panel span={12} title={`${name} - ${translate("monthly P&L")} ${picked}`} src="QAR">
        <div className="tw"><table className="pl">
          <thead><tr><th>{translate("Summary")}</th>{MONTHS.map((m) => <th key={m} className="n">{m}</th>)}<th className="n">{translate("Total")}</th></tr></thead>
          <tbody>{line(translate("Revenue"), summary.revenue)}{line(translate("Total cost"), summary.totalCost)}{line(translate("Net profit / loss"), summary.net, true)}</tbody>
        </table></div>
      </Panel>
      <Panel span={12} title={translate("By account")} src={translate("Revenue positive, costs negative")}>
        <PnlAccountTable groups={[...groups].map(([main, list]) => ({ main, kind: (list[0].sign ?? (main === "REVENUE" ? 1 : -1)) > 0 ? "revenue" as const : "cost" as const, rows: bySub(list).filter((r) => sum(r.m.map(Math.abs))) }))} />
      </Panel>
    </div>
  );
}
