import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { fmt, MONTHS, sum } from "@/lib/format";
import { link } from "@/lib/url";
import { keyFor, loadReports, plRows, report, years, type ReportRow } from "@/lib/reports";
import { listCompanies } from "@/lib/companies";
import { CompanySelect } from "@/components/CompanySelect";
import { YearSelect } from "@/components/YearSelect";
import { Panel } from "@/components/ui";

export const metadata = { title: "Monthly P&L · One Transind" };
type Params = Promise<{ company?: string; year?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection(); // statements can be uploaded at any time
  await requireUser();
  const [reports, { company, year }, all] = await Promise.all([loadReports(), searchParams, listCompanies()]);
  const companies = all.filter((c) => c.active && !c.hidden && years(reports, keyFor(c)).length);
  const selected = companies.find((c) => String(c.id) === company) ?? companies[0];
  if (!selected) return <p className="empty">No P&amp;L has been loaded for any company yet.</p>;
  const key = keyFor(selected), ys = years(reports, key);
  const picked = ys.includes(Number(year)) ? Number(year) : ys.at(-1)!;
  const rows = plRows(reports, picked, key), summary = report(reports, picked, key);
  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) groups.set(r.main, [...(groups.get(r.main) ?? []), r]);
  const cell = (v: number, key?: number) => <td key={key} className={`n num${v < 0 ? " down" : ""}`}>{v ? fmt(v) : "–"}</td>;
  const line = (label: string, m: number[], strong = false) => (
    <tr style={strong ? { fontWeight: 600 } : undefined}><td>{label}</td>{m.map((v, i) => <td key={i} className="n num">{fmt(v)}</td>)}<td className="n num">{fmt(sum(m))}</td></tr>
  );
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <CompanySelect companies={companies} value={selected.id} base="/finance/pnl" />
        <YearSelect years={ys} value={picked} base={link("/finance/pnl", { company: String(selected.id) })} />
      </div>
      <Panel span={12} title={`${selected.name} - monthly P&L ${picked}`} src="QAR">
        <div className="tw"><table>
          <thead><tr><th>Summary</th>{MONTHS.map((m) => <th key={m} className="n">{m}</th>)}<th className="n">Total</th></tr></thead>
          <tbody>{line("Revenue", summary.revenue)}{line("Total cost", summary.totalCost)}{line("Net profit / loss", summary.net, true)}</tbody>
        </table></div>
      </Panel>
      <Panel span={12} title="By account" src="Revenue positive, costs negative">
        <div className="tw"><table>
          <thead><tr><th>Account</th>{MONTHS.map((m) => <th key={m} className="n">{m}</th>)}<th className="n">Total</th></tr></thead>
          {[...groups].map(([main, list]) => (
            <tbody key={main}>
              <tr style={{ fontWeight: 600 }}><td>{main}</td>{MONTHS.map((_, i) => cell(sum(list.map((r) => r.m[i])), i))}{cell(sum(list.flatMap((r) => r.m)))}</tr>
              {list.filter((r) => sum(r.m.map(Math.abs))).map((r) => <tr key={r.sub}><td style={{ paddingLeft: 18 }}>{r.sub}</td>{r.m.map((v, i) => <td key={i} className={`n num${v < 0 ? " down" : ""}`}>{v ? fmt(v) : "–"}</td>)}{cell(sum(r.m))}</tr>)}
            </tbody>
          ))}
        </table></div>
      </Panel>
    </>
  );
}
