import { Suspense } from "react";
import { connection } from "next/server";
import { listBranchesForCompanies } from "@/lib/branches";
import { listCompanies } from "@/lib/companies";
import { latestReceiptMonth, listBranchesReceipts } from "@/lib/company-figures";
import { fmt, MONTHS, pct, sum } from "@/lib/format";
import { SECTOR } from "@/lib/org";
import { branchSummary, receiptTable } from "@/lib/receipts";
import { link } from "@/lib/url";
import { CompanySelect } from "@/components/CompanySelect";
import { MonthSelect } from "@/components/MonthSelect";
import { YearSelect } from "@/components/YearSelect";
import { HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Restaurants · One Transind" };
type Params = Promise<{ m?: string; year?: string; company?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

const share = (part: number, whole: number) => (whole ? `${fmt((part / whole) * 100, 1)}%` : "-");

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const { m, year: rawYear, company: rawCompany } = await searchParams;
  const companies = (await listCompanies("", SECTOR.foodBeverage)).filter((c) => c.active && !c.hidden);
  if (!companies.length) return <Panel span={12} title="Restaurants"><p className="empty">No restaurant company is set up.</p></Panel>;
  const allBranches = await listBranchesForCompanies(companies.map((c) => c.id));
  const branchLists = companies.map((c) => allBranches.filter((b) => b.company_id === c.id));
  const chosen = companies.findIndex((c) => String(c.id) === rawCompany);
  // With no choice in the link, open on the company with the most branches, so adding a smaller restaurant company does not change the opening view.
  const pick = chosen >= 0 ? chosen : branchLists.reduce((best, list, i) => (list.length > branchLists[best].length ? i : best), 0);
  const company = companies[pick], branches = branchLists[pick];
  const latest = await latestReceiptMonth(company.id);
  const now = new Date(), thisYear = now.getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear];
  const year = years.includes(Number(rawYear)) ? Number(rawYear) : (latest?.year ?? thisYear);
  const rawM = Number(m);
  const month = m && Number.isInteger(rawM) && rawM >= 1 && rawM <= 12 ? rawM - 1 : latest && latest.year === year ? latest.month : latest ? 11 : now.getMonth();
  const active = branches.filter((b) => b.active);
  const previous = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const load = async (y: number, mo: number) => {
    const byBranch = await listBranchesReceipts(active.map((b) => b.id), y, mo);
    return active.map((b) => {
      const table = receiptTable(byBranch.get(b.id) ?? [], y, mo);
      return { name: b.name, table, summary: branchSummary(table) };
    });
  };
  const [current, before] = await Promise.all([load(year, month), load(previous.year, previous.month)]);
  const gross = sum(current.map((b) => b.summary.gross)), cash = sum(current.map((b) => b.summary.cash)), card = sum(current.map((b) => b.summary.card)), apps = sum(current.map((b) => b.summary.deliveryApps));
  const lastMonthGross = sum(before.map((b) => b.summary.gross));
  const mn = `${MONTHS[month]} ${year}`;
  const hasData = current.some((b) => b.summary.days > 0);
  // In the current month, hide days after today to avoid a long empty list.
  const lastDay = year === thisYear && month === now.getMonth() ? now.getDate() : 31;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <MonthSelect value={month} max={11} names={MONTHS} year={year} base={link("/restaurants", { year: String(year), company: rawCompany })} />
        <YearSelect years={years} value={year} base={link("/restaurants", { m: String(month + 1), company: rawCompany })} />
        <CompanySelect companies={companies.map((c) => ({ id: c.id, name: c.name }))} value={company.id} base={link("/restaurants", { year: rawYear, m })} />
      </div>
      <div className="kpis">
        <Kpi label={`Gross sales ${mn}`} value={hasData ? `${fmt(gross)} QAR` : "-"} delta={hasData && lastMonthGross ? <>{gross >= lastMonthGross ? "▲" : "▼"} {fmt(Math.abs(pct(gross, lastMonthGross)), 1)}% vs {MONTHS[previous.month]} {previous.year}</> : undefined} up={gross >= lastMonthGross} />
        <Kpi label="Cash share" value={hasData ? share(cash, gross) : "-"} />
        <Kpi label="Card share" value={hasData ? share(card, gross) : "-"} />
        <Kpi label="Delivery apps share" value={hasData ? share(apps, gross) : "-"} />
      </div>
      <div className="grid">
        <Panel span={7} title={`Branch performance · ${mn}`}>
          {!hasData ? <p className="empty">No daily sales uploaded for {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>Branch</th><th className="n">Gross sales</th><th className="n">Cash</th><th className="n">Card</th><th className="n">Delivery apps</th><th className="n">Days</th></tr></thead>
              <tbody>
                {current.map((b) => <tr key={b.name}><td>{b.name}</td><td className="n num">{fmt(b.summary.gross)}</td><td className="n num">{fmt(b.summary.cash)}</td><td className="n num">{fmt(b.summary.card)}</td><td className="n num">{fmt(b.summary.deliveryApps)}</td><td className="n num">{b.summary.days}</td></tr>)}
                <tr><td><strong>Total</strong></td><td className="n num"><strong>{fmt(gross)}</strong></td><td className="n num">{fmt(cash)}</td><td className="n num">{fmt(card)}</td><td className="n num">{fmt(apps)}</td><td className="n num" /></tr>
              </tbody>
            </table></div>
          )}
        </Panel>
        <Panel span={5} title={`Sales by channel · ${mn}`}>
          <HBars unit=" QAR" rows={hasData ? [{ l: "Cash", v: cash }, { l: "Card", v: card }, { l: "Delivery apps", v: apps }] : []} />
          <p className="note" style={{ marginTop: 8 }}>From the branches' Daily Sales Deposit workbooks. Gross sales exclude bank deposits, which repeat cash sales. Baskin Robbins and Dunkin appear once they upload the same workbook.</p>
        </Panel>
        <Panel span={12} title={`Daily gross sales · ${mn}`}>
          {!hasData ? <p className="empty">No daily sales uploaded for {mn}.</p> : (
            <div className="tw"><table>
              <thead><tr><th>Day</th>{current.map((b) => <th key={b.name} className="n">{b.name}</th>)}<th className="n">Total</th></tr></thead>
              <tbody>
                {current[0].table.days.map((d, i) => d.day > lastDay ? null : (() => {
                  const values = current.map((b) => b.table.days[i].gross);
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
