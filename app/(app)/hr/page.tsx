import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getOverview, getSalesmen } from "@/lib/data";
import { fmt, MONTHS } from "@/lib/format";
import { listCompanies } from "@/lib/companies";
import { listEmployees } from "@/lib/employee-records";
import { headcountByCompany, latestHeadcount } from "@/lib/headcount";
import { departmentMovements, monthlyMovements } from "@/lib/employees";
import { link, parsePath } from "@/lib/url";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { Empty, Kpi, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Human resources · One Transind" };
type Params = Promise<{ h?: string }>;

// Only the staff lists (joiners and leavers) are connected; the organisation structure is the legacy one, with no headcounts.
export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={3} panels={1} />}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("hr");
  const translate = translator(await getLanguage());
  const { h } = await searchParams;
  const p = parsePath(h);
  const o = await getOverview();
  const team = await getSalesmen(o.month);
  const year = new Date().getFullYear();
  const [staff, registry] = await Promise.all([
    listEmployees(),
    listCompanies(),
  ]);
  const headcount = latestHeadcount();
  const moves = monthlyMovements(staff, year), byCompany = departmentMovements(staff.map((e) => ({ ...e, department: e.company })), year);
  // Directory counts come from the department headcount files; the people list under a department is whoever on the staff lists carries that department name.
  const byHeadcount = headcountByCompany();
  const companies = [...registry.filter((c) => !c.hidden).map((c) => c.name), ...(byHeadcount.companies.has("Unassigned") ? ["Unassigned"] : [])]
    .map((name): [string, number] => [name, byHeadcount.companies.get(name) ?? 0]).sort((x, y) => (x[0] === "Unassigned" ? 1 : y[0] === "Unassigned" ? -1 : y[1] - x[1] || x[0].localeCompare(y[0])));
  const company = companies.some(([name]) => name === p[0]) ? p[0] : undefined;
  const units = company ? byHeadcount.departments(company) : [];
  const unit = units.some(([name]) => name === p[1]) ? p[1] : undefined;
  const people = unit ? staff.filter((e) => !e.left && e.department.trim().toUpperCase() === unit).sort((x, y) => y.joined.localeCompare(x.joined)) : [];
  const unitCount = units.find(([name]) => name === unit)?.[1] ?? 0;
  const list = company ? units : companies, biggest = Math.max(1, ...list.map((r) => r[1])), crumbs = [company, unit].filter((x): x is string => !!x);

  return (
    <>
      <div className="kpis">
        <Kpi label={translate("Active employees")} value={headcount ? fmt(headcount.total) : "—"} delta={headcount ? `${MONTHS[Number(headcount.month.slice(5)) - 1]} ${headcount.month.slice(0, 4)} · ${translate("department headcount files")}` : undefined} up />
        <Kpi label={`${translate("Joined")} ${year}`} value={fmt(moves.joiners.reduce((x, y) => x + y, 0))} />
        <Kpi label={`${translate("Left")} ${year}`} value={fmt(moves.leavers.reduce((x, y) => x + y, 0))} />
      </div>
      <div className="grid">
        <section className="panel c12">
          <header><h2>{translate("Employee directory")}</h2></header>
          <div className="mtd"><span className="src">{translate("Counts from the department headcount files; names from the new-hire and leaver lists")}</span></div>
          <nav className="crumbs" aria-label="breadcrumb" style={{ marginBottom: 8 }}>
            {crumbs.length ? <Link href="/hr">{translate("All")}</Link> : <span className="cur">{translate("All")}</span>}
            {crumbs.map((c, i) => <span key={c} style={{ display: "contents" }}><i>›</i>{i < crumbs.length - 1 ? <Link href={link("/hr", { h: crumbs.slice(0, i + 1).join("|") })}>{c}</Link> : <span className="cur">{c}</span>}</span>)}
          </nav>
          {!headcount ? <p className="empty">{translate("No headcount files loaded yet")}</p> : company && !units.length ? <p className="empty">No departments linked to {company} yet. Add them on the company page under Admin, Companies.</p> : !unit ? (
            <div className="drill">{list.map(([name, count]) => (
              <Link key={name} className="dr" href={link("/hr", { h: [...crumbs, name].join("|") })}>
                <span className="lab">{name}</span>
                <span className="track"><span className="fill" style={{ width: `${(count / biggest) * 100}%` }} /></span>
                <span className="num" style={{ textAlign: "end" }}>{fmt(count)}</span><span className="chev" aria-hidden="true">›</span>
              </Link>))}</div>
          ) : (
            <><p className="empty">{fmt(people.length)} {translate("of")} {fmt(unitCount)} {translate("are named on the staff lists")}</p><div className="tw scroll"><table className="sticky-col sticky-head">
              <thead><tr><th>{translate("Name")}</th><th>{translate("Employee ID")}</th><th>{translate("Job title")}</th><th>{translate("Nationality")}</th><th>{translate("Joined")}</th><th>{translate("Left")}</th></tr></thead>
              <tbody>{people.map((e) => <tr key={e.id}><td>{e.name}</td><td>{e.id}</td><td>{e.designation}</td><td>{e.nationality}</td><td>{e.joined}</td><td>{e.left ?? "—"}</td></tr>)}</tbody>
            </table></div></>
          )}
        </section>
        <Panel span={12} title={`${translate("Salesmen")} · ${MONTHS[o.month]} ${o.year}`}>
          <div className="tw"><table>
            <thead><tr><th>{translate("Name")}</th><th className="n">{translate("Sales (QAR)")}</th><th className="n">{translate("Customers")}</th><th className="n">{translate("Documents")}</th></tr></thead>
            <tbody>{team.map((m) => <tr key={m.name}><td><span className="who"><span className="avatar">{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>{m.name}</span></td><td className="n num">{fmt(m.value)}</td><td className="n num">{m.customers}</td><td className="n num">{fmt(m.docs)}</td></tr>)}</tbody>
          </table></div>
        </Panel>
        <Panel span={7} title={`${translate("Joiners and leavers")} · ${year}`}>
          {staff.length ? (
            <div className="tw"><table>
              <thead><tr><th></th>{MONTHS.map((m) => <th key={m} className="n">{m}</th>)}<th className="n">{translate("Total")}</th></tr></thead>
              <tbody>{([["Joined", moves.joiners], ["Left", moves.leavers]] as const).map(([label, row]) => <tr key={label}><td>{translate(label)}</td>{row.map((v, i) => <td key={i} className="n num">{v || "—"}</td>)}<td className="n num">{fmt(row.reduce((a, b) => a + b, 0))}</td></tr>)}</tbody>
            </table></div>
          ) : <p className="empty">{translate("No staff lists uploaded yet")}</p>}
        </Panel>
        <Panel span={5} title={`${translate("By company")} · ${year}`}>
          <div className="tw"><table>
            <thead><tr><th>{translate("Company")}</th><th className="n">{translate("Joined")}</th><th className="n">{translate("Left")}</th></tr></thead>
            <tbody>{byCompany.length ? byCompany.map((d) => <tr key={d.department}><td>{d.department}</td><td className="n num">{d.joiners}</td><td className="n num">{d.leavers}</td></tr>) : <Empty cols={3} text="—" />}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
