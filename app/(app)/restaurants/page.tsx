import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { listBranchesForCompanies } from "@/lib/branches";
import { listCompanies } from "@/lib/companies";
import { latestReceiptMonth, listBranchesReceipts, listCogsMonth } from "@/lib/company-figures";
import { fmt, MONTHS, pct, sum } from "@/lib/format";
import { SECTOR } from "@/lib/org";
import { branchSummary, receiptTable } from "@/lib/receipts";
import { link } from "@/lib/url";
import { CompanySelect } from "@/components/CompanySelect";
import { MonthSelect } from "@/components/MonthSelect";
import { YearSelect } from "@/components/YearSelect";
import { HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Restaurants · One Transind" };
type Params = Promise<{ m?: string; year?: string; company?: string; branch?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const share = (part: number, whole: number) => (whole ? `${fmt((part / whole) * 100, 1)}%` : "-");

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const { m, year: rawYear, company: rawCompany, branch: rawBranch } = await searchParams;
  const companies = (await listCompanies("", SECTOR.foodBeverage)).filter((c) => c.active && !c.hidden);
  if (!companies.length) return <Panel span={12} title="Restaurants"><p className="empty">No restaurant company is set up.</p></Panel>;
  const allBranches = await listBranchesForCompanies(companies.map((c) => c.id));
  const branchLists = companies.map((c) => allBranches.filter((b) => b.company_id === c.id));
  const chosen = companies.findIndex((c) => String(c.id) === rawCompany);
  // With no choice in the link, open on the company with the most branches, so adding a smaller restaurant company does not change the opening view.
  const pick = chosen >= 0 ? chosen : branchLists.reduce((best, list, i) => (list.length > branchLists[best].length ? i : best), 0);
  const all = rawCompany === "all";
  const company = companies[pick];
  const shown = all ? companies : [company];
  const branches = all ? allBranches : branchLists[pick];
  const chosenBranch = branches.find((b) => String(b.id) === rawBranch);
  const latest = (await Promise.all(shown.map((c) => latestReceiptMonth(c.id)))).reduce<{ year: number; month: number } | null>((best, l) => (l && (!best || l.year * 12 + l.month > best.year * 12 + best.month) ? l : best), null);
  const now = new Date(), thisYear = now.getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear];
  const year = years.includes(Number(rawYear)) ? Number(rawYear) : (latest?.year ?? thisYear);
  const rawM = Number(m);
  const month = m && Number.isInteger(rawM) && rawM >= 1 && rawM <= 12 ? rawM - 1 : latest && latest.year === year ? latest.month : latest ? 11 : now.getMonth();
  const active = branches.filter((b) => b.active && (!chosenBranch || b.id === chosenBranch.id));
  // Cost of goods rows without a branch belong to the whole company, so they drop out once one branch is chosen.
  // Month "all" covers the whole year: every figure below is added up over these months.
  const allMonths = m === "all";
  const months = allMonths ? Array.from({ length: 12 }, (_, i) => i) : [month];
  const loadCogs = async (y: number) => {
    const rows = (await Promise.all(months.flatMap((mo) => shown.map(async (c) => (await listCogsMonth(c.id, y, mo)).map((r) => ({ ...r, branch: r.branch ?? c.name })))))).flat().filter((r) => !chosenBranch || r.branch === chosenBranch.name);
    const byName = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const seen = byName.get(r.branch);
      byName.set(r.branch, !seen ? r : { branch: r.branch, grossSales: (seen.grossSales ?? 0) + (r.grossSales ?? 0), discount: (seen.discount ?? 0) + (r.discount ?? 0), netSales: (seen.netSales ?? 0) + (r.netSales ?? 0), cogs: (seen.cogs ?? 0) + (r.cogs ?? 0) });
    }
    return [...byName.values()];
  };
  // The comparison is the same month (or whole year) a year earlier.
  const previous = { year: year - 1, month };
  const load = async (y: number) => {
    const perMonth = await Promise.all(months.map(async (mo) => {
      const byBranch = await listBranchesReceipts(active.map((b) => b.id), y, mo);
      return active.map((b) => receiptTable(byBranch.get(b.id) ?? [], y, mo));
    }));
    return active.map((b, i) => {
      const summaries = perMonth.map((tables) => branchSummary(tables[i]));
      const summary = { gross: sum(summaries.map((s) => s.gross)), cash: sum(summaries.map((s) => s.cash)), card: sum(summaries.map((s) => s.card)), deliveryApps: sum(summaries.map((s) => s.deliveryApps)), days: sum(summaries.map((s) => s.days)) };
      return { name: b.name, table: perMonth[0][i], summary };
    });
  };
  const [current, before, cogsRows, cogsBefore] = await Promise.all([load(year), load(previous.year), loadCogs(year), loadCogs(previous.year)]);
  const cogsNet = sum(cogsRows.map((r) => r.netSales ?? 0)), cogsCost = sum(cogsRows.map((r) => -(r.cogs ?? 0)));
  const cogsDiscount = sum(cogsRows.map((r) => -(r.discount ?? 0))), cogsGross = sum(cogsRows.map((r) => r.grossSales ?? 0));
  const costShare = (cost: number, net: number) => (net ? `${fmt((cost / net) * 100, 1)}%` : "-");
  const gross = sum(current.map((b) => b.summary.gross)), cash = sum(current.map((b) => b.summary.cash)), card = sum(current.map((b) => b.summary.card)), apps = sum(current.map((b) => b.summary.deliveryApps));
  const mn = allMonths ? `${year}` : `${MONTHS[month]} ${year}`;
  const monthParam = allMonths ? "all" : String(month + 1);
  const hasData = current.some((b) => b.summary.days > 0);
  // No daily deposit book for the month (2024, 2025): fall back to the monthly gross sales from the COGS workbook. It has no cash or card split, so those stay blank.
  // Daily table: only branches with sales that month, so closed or not-yet-open branches (Umm Salal, MS 43, Bin Omran before it opened) do not show as empty columns.
  const withSales = current.filter((b) => b.summary.days > 0);
  const monthlyOnly = !hasData && cogsRows.length > 0;
  const shownGross = monthlyOnly ? sum(cogsRows.map((r) => r.grossSales ?? 0)) : gross;
  // The same month last year may have only the COGS workbook figure (no daily deposit book), so use it when the daily total is empty.
  const lastMonthGross = (!monthlyOnly && sum(before.map((b) => b.summary.gross))) || sum(cogsBefore.map((r) => r.grossSales ?? 0));
  // In the current month, hide days after today to avoid a long empty list.
  const lastDay = year === thisYear && month === now.getMonth() ? now.getDate() : 31;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <MonthSelect value={allMonths ? "all" : month} allLabel="All months" max={11} names={MONTHS} year={year} base={link("/restaurants", { year: String(year), company: rawCompany, branch: rawBranch })} />
        <YearSelect years={years} value={year} base={link("/restaurants", { m: monthParam, company: rawCompany, branch: rawBranch })} />
        <CompanySelect companies={companies.map((c) => ({ id: c.id, name: c.name }))} value={all ? "all" : company.id} allLabel="All companies" base={link("/restaurants", { year: rawYear, m })} />
        <CompanySelect param="branch" label="Branch" companies={branches.map((b) => ({ id: b.id, name: b.name }))} value={chosenBranch?.id ?? "all"} allLabel="All branches" base={link("/restaurants", { year: rawYear, m, company: rawCompany })} />
      </div>
      <div className="kpis">
        <Kpi label={`Gross sales ${mn}`} value={hasData || monthlyOnly ? `${fmt(shownGross)} QAR` : "-"} delta={(hasData || monthlyOnly) && lastMonthGross ? <>{shownGross >= lastMonthGross ? "▲" : "▼"} {fmt(Math.abs(pct(shownGross, lastMonthGross)), 1)}% vs {allMonths ? "" : `${MONTHS[previous.month]} `}{previous.year}</> : undefined} up={shownGross >= lastMonthGross} />
        <Kpi label={`Cost of goods ${mn}`} value={cogsRows.length ? `${fmt(cogsCost)} QAR` : "-"} delta={cogsRows.length && cogsNet ? <>{costShare(cogsCost, cogsNet)} of net sales</> : undefined} />
        <Kpi label="Cash share" value={hasData ? share(cash, gross) : "-"} />
        <Kpi label="Card share" value={hasData ? share(card, gross) : "-"} />
        <Kpi label="Delivery apps share" value={hasData ? share(apps, gross) : "-"} />
        <Kpi label={`Discount ${mn}`} value={cogsRows.length ? `${fmt(cogsDiscount)} QAR` : "-"} delta={cogsRows.length && cogsGross ? <>{fmt((cogsDiscount / cogsGross) * 100, 1)}% of gross sales</> : undefined} />
      </div>
      <div className="grid">
        <Panel span={12} title={`Cost of goods · ${mn}`}>
          {!cogsRows.length ? <p className="empty">No COGS uploaded for {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>Branch</th><th className="n">Net sales</th><th className="n">Cost of goods</th><th className="n">Cost %</th></tr></thead>
              <tbody>
                {cogsRows.map((r) => <tr key={r.branch ?? "company"}><td>{r.branch ?? company.name}</td><td className="n num">{fmt(r.netSales ?? 0)}</td><td className="n num">{fmt(-(r.cogs ?? 0))}</td><td className="n num">{costShare(-(r.cogs ?? 0), r.netSales ?? 0)}</td></tr>)}
                {cogsRows.length > 1 && <tr><td><strong>Total</strong></td><td className="n num"><strong>{fmt(cogsNet)}</strong></td><td className="n num">{fmt(cogsCost)}</td><td className="n num">{costShare(cogsCost, cogsNet)}</td></tr>}
              </tbody>
            </table></div>
          )}
          <p className="note" style={{ marginTop: 8 }}>From the monthly Restaurants COGS Summary workbook. Cost % is cost of goods divided by net sales.</p>
        </Panel>
        <Panel span={7} title={`Branch performance · ${mn}`}>
          {monthlyOnly ? (
            <div className="tw"><table>
              <thead><tr><th>Branch</th><th className="n">Gross sales</th><th className="n">Cost of goods</th><th className="n">Cost %</th></tr></thead>
              <tbody>
                {cogsRows.filter((r) => r.grossSales).map((r) => <tr key={r.branch ?? "company"}><td>{r.branch ?? company.name}</td><td className="n num">{fmt(r.grossSales ?? 0)}</td><td className="n num">{fmt(-(r.cogs ?? 0))}</td><td className="n num">{costShare(-(r.cogs ?? 0), r.netSales ?? 0)}</td></tr>)}
                {cogsRows.length > 1 && <tr><td><strong>Total</strong></td><td className="n num"><strong>{fmt(shownGross)}</strong></td><td className="n num">{fmt(cogsCost)}</td><td className="n num">{costShare(cogsCost, cogsNet)}</td></tr>}
              </tbody>
            </table></div>
          ) : !hasData ? <p className="empty">No daily sales uploaded for {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>Branch</th><th className="n">Gross sales</th><th className="n">Cash</th><th className="n">Card</th><th className="n">Delivery apps</th><th className="n">Days</th></tr></thead>
              <tbody>
                {current.filter((b) => b.summary.gross !== 0).map((b) => <tr key={b.name}><td>{b.name}</td><td className="n num">{fmt(b.summary.gross)}</td><td className="n num">{fmt(b.summary.cash)}</td><td className="n num">{fmt(b.summary.card)}</td><td className="n num">{fmt(b.summary.deliveryApps)}</td><td className="n num">{b.summary.days}</td></tr>)}
                <tr><td><strong>Total</strong></td><td className="n num"><strong>{fmt(gross)}</strong></td><td className="n num">{fmt(cash)}</td><td className="n num">{fmt(card)}</td><td className="n num">{fmt(apps)}</td><td className="n num" /></tr>
              </tbody>
            </table></div>
          )}
        </Panel>
        <Panel span={5} title={`Sales by channel · ${mn}`}>
          <HBars unit=" QAR" rows={hasData ? [{ l: "Cash", v: cash }, { l: "Card", v: card }, { l: "Delivery apps", v: apps }] : []} />
          <p className="note" style={{ marginTop: 8 }}>{monthlyOnly ? "No daily deposit book for this month, so gross sales are the monthly figure from the COGS workbook and there is no cash or card split. " : ""}From the branches' Daily Sales Deposit workbooks. Gross sales exclude bank deposits, which repeat cash sales. Baskin Robbins and Dunkin appear once they upload the same workbook.</p>
        </Panel>
        <Panel span={12} title={`Daily gross sales · ${mn}`}>
          {allMonths ? <p className="empty">Pick a single month to see daily sales.</p> : !hasData ? <p className="empty">No daily sales uploaded for {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>Day</th>{withSales.map((b) => <th key={b.name} className="n">{b.name}</th>)}<th className="n">Total</th></tr></thead>
              <tbody>
                {withSales[0].table.days.map((d, i) => d.day > lastDay ? null : (() => {
                  const values = withSales.map((b) => b.table.days[i].gross);
                  return <tr key={d.day}><td>{String(d.day).padStart(2, "0")} {MONTHS[month]}</td>{values.map((v, k) => <td key={k} className="n num">{v === null ? "" : fmt(v)}</td>)}<td className="n num">{values.some((v) => v !== null) ? fmt(sum(values.map((v) => v ?? 0))) : ""}</td></tr>;
                })())}
              </tbody>
            </table></div>
          )}
        </Panel>
      </div>
    </>
  );
}
