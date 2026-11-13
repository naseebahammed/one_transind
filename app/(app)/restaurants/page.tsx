import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { listBranchesForCompanies } from "@/lib/branches";
import { listCompanies } from "@/lib/companies";
import { latestReceiptMonthForCompanies, listBranchesReceiptsPeriods, listCogsPeriods } from "@/lib/company-figures";
import { fmt, MONTHS, pct, sum } from "@/lib/format";
import { SECTOR } from "@/lib/org";
import { branchSummary, deliveryAppTotals, receiptTable } from "@/lib/receipts";
import { link } from "@/lib/url";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { CompanySelect } from "@/components/CompanySelect";
import { MonthSelect } from "@/components/MonthSelect";
import { YearSelect } from "@/components/YearSelect";
import { DayBars, HBars, Kpi, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Restaurants · One Transind" };
type Params = Promise<{ m?: string; year?: string; company?: string; branch?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={4} hasFilters panels={2} />}><Content searchParams={searchParams} /></Suspense>;
}

const share = (part: number, whole: number) => (whole ? `${fmt((part / whole) * 100, 1)}%` : "-");

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("restaurants");
  const translate = translator(await getLanguage());
  const { m, year: rawYear, company: rawCompany, branch: rawBranch } = await searchParams;
  const companies = (await listCompanies("", SECTOR.foodBeverage)).filter((c) => c.active && !c.hidden);
  if (!companies.length) return <Panel span={12} title={translate("Restaurants")}><p className="empty">No restaurant company is set up.</p></Panel>;
  const allBranches = await listBranchesForCompanies(companies.map((c) => c.id));
  const branchLists = companies.map((c) => allBranches.filter((b) => b.company_id === c.id));
  const chosen = companies.findIndex((c) => String(c.id) === rawCompany);
  // With no company in the link, open on all companies. An unknown company id falls back to the one with the most branches.
  const pick = chosen >= 0 ? chosen : branchLists.reduce((best, list, i) => (list.length > branchLists[best].length ? i : best), 0);
  const all = rawCompany === "all" || rawCompany === undefined;
  const company = companies[pick];
  const shown = all ? companies : [company];
  const branches = all ? allBranches : branchLists[pick];
  const chosenBranch = branches.find((b) => String(b.id) === rawBranch);
  const latest = await latestReceiptMonthForCompanies(shown.map((c) => c.id));
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
  // The comparison is the same month (or whole year) a year earlier.
  const previous = { year: year - 1, month };
  const requestedPeriods = [
    ...months.map((mo) => ({ year, month: mo })),
    ...months.map((mo) => ({ year: previous.year, month: mo })),
  ];
  const [receiptsByBranchMonth, allCogsRows] = await Promise.all([
    listBranchesReceiptsPeriods(active.map((b) => b.id), requestedPeriods),
    listCogsPeriods(shown.map((c) => c.id), requestedPeriods),
  ]);
  const companyNames = new Map(shown.map((c) => [c.id, c.name]));
  const loadCogs = (targetYear: number) => {
    const rows = allCogsRows
      .filter((r) => r.year === targetYear)
      .map((r) => ({ companyId: r.companyId, branch: r.branch ?? companyNames.get(r.companyId) ?? company.name, grossSales: r.grossSales, discount: r.discount, netSales: r.netSales, cogs: r.cogs }))
      .filter((r) => !chosenBranch || r.branch === chosenBranch.name);
    const byName = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const key = `${r.companyId}|${r.branch}`, seen = byName.get(key);
      byName.set(key, !seen ? r : { companyId: r.companyId, branch: r.branch, grossSales: (seen.grossSales ?? 0) + (r.grossSales ?? 0), discount: (seen.discount ?? 0) + (r.discount ?? 0), netSales: (seen.netSales ?? 0) + (r.netSales ?? 0), cogs: (seen.cogs ?? 0) + (r.cogs ?? 0) });
    }
    return [...byName.values()];
  };
  const load = (targetYear: number) => {
    const perMonth = months.map((mo) =>
      active.map((b) => receiptTable(receiptsByBranchMonth.get(`${b.id}|${targetYear}-${mo}`) ?? [], targetYear, mo)),
    );
    return active.map((b, i) => {
      const summaries = perMonth.map((tables) => branchSummary(tables[i]));
      const summary = { gross: sum(summaries.map((s) => s.gross)), cash: sum(summaries.map((s) => s.cash)), card: sum(summaries.map((s) => s.card)), deliveryApps: sum(summaries.map((s) => s.deliveryApps)), days: sum(summaries.map((s) => s.days)) };
      const apps: Record<string, number> = {};
      for (const tables of perMonth) for (const [app, value] of Object.entries(deliveryAppTotals(tables[i]))) apps[app] = (apps[app] ?? 0) + value;
      return { id: b.id, name: b.name, companyId: b.company_id, table: perMonth[0][i], summary, apps };
    });
  };
  const current = load(year), before = load(previous.year), cogsRows = loadCogs(year), cogsBefore = loadCogs(previous.year);
  const cogsNet = sum(cogsRows.map((r) => r.netSales ?? 0)), cogsCost = sum(cogsRows.map((r) => -(r.cogs ?? 0)));
  // Two companies can have a branch with the same name, so with several companies shown the company name is added.
  const branchLabel = (name: string, companyId: number) => (shown.length > 1 ? `${companyInitials(companyId)} · ${name}` : name);
  // Initials of the company name for narrow headings: "Mr. Shawarma" -> MS, "Burger Stop" -> BS.
  const companyInitials = (companyId: number) => (companyNames.get(companyId) ?? "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("");
  const costShare = (cost: number, net: number) => (net ? `${fmt((cost / net) * 100, 1)}%` : "-");
  const gross = sum(current.map((b) => b.summary.gross)), cash = sum(current.map((b) => b.summary.cash)), card = sum(current.map((b) => b.summary.card)), apps = sum(current.map((b) => b.summary.deliveryApps));
  const appSales = new Map<string, number>();
  for (const b of current) for (const [app, value] of Object.entries(b.apps)) appSales.set(app, (appSales.get(app) ?? 0) + value);
  // Percentages are of the channel total shown (in-store + apps), which can differ slightly from gross sales when a delivery discount is negative.
  const channels = ([[translate("In-store"), cash + card], ...appSales] as [string, number][]).sort((x, y) => y[1] - x[1]);
  const channelTotal = sum(channels.map(([, value]) => value));
  const mn = allMonths ? `${year}` : `${MONTHS[month]} ${year}`;
  const monthParam = allMonths ? "all" : String(month + 1);
  const hasData = current.some((b) => b.summary.days > 0);
  // No daily deposit book for the month (2024, 2025): fall back to the monthly gross sales from the COGS workbook. It has no cash or card split, so those stay blank.
  // Daily table: only branches with sales that month, so closed or not-yet-open branches (Umm Salal, MS 43, Bin Omran before it opened) do not show as empty columns.
  const withSales = current.filter((b) => b.summary.days > 0);
  const monthlyOnly = !hasData && cogsRows.length > 0;
  const companyTotals = new Map<number, number>();
  for (const r of monthlyOnly ? cogsRows.map((c) => ({ companyId: c.companyId, value: c.grossSales ?? 0 })) : current.map((b) => ({ companyId: b.companyId, value: b.summary.gross }))) companyTotals.set(r.companyId, (companyTotals.get(r.companyId) ?? 0) + r.value);
  const companyBars = [...companyTotals].map(([id, value]) => ({ label: companyNames.get(id) ?? "", value })).filter((c) => c.value > 0).sort((x, y) => y.value - x.value);
  // Day-by-day total of the shown branches; null when no branch has a figure that day. Same-month-last-year may be a day shorter (leap year), so missing days read as null.
  const dailyTotals = (branchesToAdd: typeof current) => (withSales[0]?.table.days ?? []).map((_, i) => { const dayValues = branchesToAdd.map((b) => b.table.days[i]?.gross ?? null); return dayValues.some((v) => v !== null) ? sum(dayValues.map((v) => v ?? 0)) : null; });
  const shownGross = monthlyOnly ? sum(cogsRows.map((r) => r.grossSales ?? 0)) : gross;
  // The same month last year may have only the COGS workbook figure (no daily deposit book), so use it when the daily total is empty.
  const lastMonthGross = (!monthlyOnly && sum(before.map((b) => b.summary.gross))) || sum(cogsBefore.map((r) => r.grossSales ?? 0));
  // In the current month, hide days after today to avoid a long empty list.
  const lastDay = year === thisYear && month === now.getMonth() ? now.getDate() : 31;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <MonthSelect value={allMonths ? "all" : month} allLabel={translate("All months")} max={year === thisYear ? now.getMonth() : 11} names={MONTHS} year={year} base={link("/restaurants", { year: String(year), company: rawCompany, branch: rawBranch })} />
        <YearSelect years={years} value={year} base={link("/restaurants", { m: monthParam, company: rawCompany, branch: rawBranch })} />
        <CompanySelect companies={companies.map((c) => ({ id: c.id, name: c.name }))} value={all ? "all" : company.id} allLabel={translate("All companies")} base={link("/restaurants", { year: rawYear, m })} />
        <CompanySelect param="branch" label={translate("Branch")} companies={branches.map((b) => ({ id: b.id, name: b.name }))} value={chosenBranch?.id ?? "all"} allLabel={translate("All branches")} base={link("/restaurants", { year: rawYear, m, company: rawCompany })} />
      </div>
      <div className="kpis kpis-n">
        <Kpi label={`${translate("Gross sales")} ${mn}`} value={hasData || monthlyOnly ? `${fmt(shownGross)} QAR` : "-"} delta={(hasData || monthlyOnly) && lastMonthGross ? <>{shownGross >= lastMonthGross ? "▲" : "▼"} {fmt(Math.abs(pct(shownGross, lastMonthGross)), 1)}% {translate("vs")} {allMonths ? "" : `${MONTHS[previous.month]} `}{previous.year}</> : undefined} up={shownGross >= lastMonthGross} />
        <Kpi label={`${translate("Cost of goods")} ${mn}`} value={cogsRows.length ? `${fmt(cogsCost)} QAR` : "-"} delta={cogsRows.length && cogsNet ? <>{costShare(cogsCost, cogsNet)} {translate("of net sales")}</> : undefined} />
        <Kpi label={translate("Cash share")} value={hasData ? share(cash, gross) : "-"} />
        <Kpi label={translate("Card share")} value={hasData ? share(card, gross) : "-"} />
      </div>
      <div className="grid">
        <Panel span={7} title={`${translate("Daily gross sales")} · ${mn}`} src={allMonths || !hasData ? undefined : `${translate("Shaded")}: ${MONTHS[month]} ${previous.year}`}>
          {allMonths ? <p className="empty">{translate("Pick a single month to see daily sales.")}</p> : !hasData ? <p className="empty">{translate("No daily sales uploaded for")} {mn}.</p> : (
            <DayBars days={withSales[0].table.days.map((d) => `${String(d.day).padStart(2, "0")} ${MONTHS[month]}`)} values={dailyTotals(current)} compare={dailyTotals(before)} compareLabel={`${MONTHS[month]} ${previous.year}`} />
          )}
        </Panel>
        <Panel span={5} title={`${translate("Sales by company & channel")} · ${mn}`}>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>{translate("By company")}</h3>
              <HBars unit=" QAR" rows={companyBars.map((b) => ({ l: b.label, v: b.value, after: share(b.value, shownGross) }))} />
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>{translate("By channel")}</h3>
              <HBars unit=" QAR" rows={hasData ? channels.map(([name, value]) => ({ l: name, v: value, after: share(value, channelTotal) })) : []} />
            </div>
          </div>
          <p className="note" style={{ marginTop: 8 }}>{monthlyOnly ? "No daily deposit book for this month, so gross sales are the monthly figure from the COGS workbook and there is no cash or card split. " : ""}From the branches&apos; Daily Sales Deposit workbooks. Gross sales exclude bank deposits, which repeat cash sales.</p>
        </Panel>
        <Panel span={12} title={`${translate("Branch performance")} · ${mn}`}>
          {monthlyOnly ? (
            <div className="tw"><table>
              <thead><tr><th>{translate("Branch")}</th><th className="n">{translate("Gross sales")}</th><th className="n">{translate("Cost of goods")}</th><th className="n">{translate("Cost %")}</th></tr></thead>
              <tbody>
                {cogsRows.filter((r) => r.grossSales).map((r) => <tr key={`${r.companyId}|${r.branch}`}><td>{branchLabel(r.branch, r.companyId)}</td><td className="n num">{fmt(r.grossSales ?? 0)}</td><td className="n num">{fmt(-(r.cogs ?? 0))}</td><td className="n num">{costShare(-(r.cogs ?? 0), r.netSales ?? 0)}</td></tr>)}
                {cogsRows.length > 1 && <tr><td><strong>{translate("Total")}</strong></td><td className="n num"><strong>{fmt(shownGross)}</strong></td><td className="n num">{fmt(cogsCost)}</td><td className="n num">{costShare(cogsCost, cogsNet)}</td></tr>}
              </tbody>
            </table></div>
          ) : !hasData ? <p className="empty">{translate("No daily sales uploaded for")} {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>{translate("Branch")}</th><th className="n">{translate("Gross sales")}</th><th className="n">{translate("Cash")}</th><th className="n">{translate("Card")}</th><th className="n">{translate("Delivery apps")}</th><th className="n">{translate("Days")}</th></tr></thead>
              <tbody>
                {current.filter((b) => b.summary.gross !== 0).map((b) => <tr key={b.id}><td>{branchLabel(b.name, b.companyId)}</td><td className="n num">{fmt(b.summary.gross)}</td><td className="n num">{fmt(b.summary.cash)}</td><td className="n num">{fmt(b.summary.card)}</td><td className="n num">{fmt(b.summary.deliveryApps)}</td><td className="n num">{b.summary.days}</td></tr>)}
                <tr><td><strong>{translate("Total")}</strong></td><td className="n num"><strong>{fmt(gross)}</strong></td><td className="n num">{fmt(cash)}</td><td className="n num">{fmt(card)}</td><td className="n num">{fmt(apps)}</td><td className="n num" /></tr>
              </tbody>
            </table></div>
          )}
        </Panel>
        <Panel span={12} title={`${translate("Cost of goods")} · ${mn}`}>
          {!cogsRows.length ? <p className="empty">{translate("No COGS uploaded for")} {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>{translate("Branch")}</th><th className="n">{translate("Net sales")}</th><th className="n">{translate("Cost of goods")}</th><th className="n">{translate("Cost %")}</th></tr></thead>
              <tbody>
                {cogsRows.map((r) => <tr key={r.branch ?? "company"}><td>{r.branch ?? company.name}</td><td className="n num">{fmt(r.netSales ?? 0)}</td><td className="n num">{fmt(-(r.cogs ?? 0))}</td><td className="n num">{costShare(-(r.cogs ?? 0), r.netSales ?? 0)}</td></tr>)}
                {cogsRows.length > 1 && <tr><td><strong>{translate("Total")}</strong></td><td className="n num"><strong>{fmt(cogsNet)}</strong></td><td className="n num">{fmt(cogsCost)}</td><td className="n num">{costShare(cogsCost, cogsNet)}</td></tr>}
              </tbody>
            </table></div>
          )}
          <p className="note" style={{ marginTop: 8 }}>From the monthly Restaurants COGS Summary workbook. Cost % is cost of goods divided by net sales.</p>
        </Panel>
        <Panel span={12} title={`${translate("Daily sales table")} · ${mn}`}>
          {allMonths ? <p className="empty">{translate("Pick a single month to see daily sales.")}</p> : !hasData ? <p className="empty">{translate("No daily sales uploaded for")} {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>{translate("Day")}</th>{withSales.map((b) => <th key={b.id} className="n">{branchLabel(b.name, b.companyId)}</th>)}<th className="n">{translate("Total")}</th></tr></thead>
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
