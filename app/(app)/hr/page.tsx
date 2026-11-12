import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getOverview, getSalesmen } from "@/lib/data";
import { fmt, MONTHS } from "@/lib/format";
import { listCompanies } from "@/lib/companies";
import { listEmployees } from "@/lib/employee-records";
import { departmentMovements, monthlyMovements } from "@/lib/employees";
import { listHrExpiringDocuments, listHrLeaveRequests } from "@/lib/manual-report-records";
import { link, parsePath } from "@/lib/url";
import { Empty, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Human resources · One Transind" };
type Params = Promise<{ h?: string }>;

// Only the staff lists (joiners and leavers) are connected; the organisation structure is the legacy one, with no headcounts.
export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const { h } = await searchParams;
  const p = parsePath(h);
  const o = await getOverview();
  const team = await getSalesmen(o.month);
  const year = new Date().getFullYear();
  const [staff, registry, leaves, expiringDocs] = await Promise.all([
    listEmployees(),
    listCompanies(),
    listHrLeaveRequests(),
    listHrExpiringDocuments(),
  ]);
  const pendingLeaves = leaves.filter((l) => l.status.toLowerCase() === "pending").length;
  const moves = monthlyMovements(staff, year), byCompany = departmentMovements(staff.map((e) => ({ ...e, department: e.company })), year);
  const countBy = (rows: typeof staff, key: "company" | "unit") => {
    const counts = new Map<string, number>();
    for (const e of rows) counts.set(e[key], (counts.get(e[key]) ?? 0) + 1);
    return [...counts].sort((x, y) => y[1] - x[1]);
  };
  // Path: company, then department (unit), then the people.
  // Every registered company is listed, with 0 until a department is added to it; people not yet linked to one show as Unassigned.
  const counts = new Map(countBy(staff, "company"));
  const companies = [...registry.filter((c) => !c.hidden).map((c) => c.name), ...(counts.has("Unassigned") ? ["Unassigned"] : [])]
    .map((name): [string, number] => [name, counts.get(name) ?? 0]).sort((x, y) => (x[0] === "Unassigned" ? 1 : y[0] === "Unassigned" ? -1 : y[1] - x[1] || x[0].localeCompare(y[0])));
  const company = companies.some(([name]) => name === p[0]) ? p[0] : undefined;
  const units = company ? countBy(staff.filter((e) => e.company === company), "unit") : [];
  const unit = units.some(([name]) => name === p[1]) ? p[1] : undefined;
  const people = company && unit ? staff.filter((e) => e.company === company && e.unit === unit).sort((x, y) => y.joined.localeCompare(x.joined)) : [];
  const list = company ? units : companies, biggest = Math.max(1, ...list.map((r) => r[1])), crumbs = [company, unit].filter((x): x is string => !!x);

  return (
    <>
      <div className="kpis">
        <Kpi label={`Joined ${year}`} value={fmt(moves.joiners.reduce((x, y) => x + y, 0))} />
        <Kpi label={`Left ${year}`} value={fmt(moves.leavers.reduce((x, y) => x + y, 0))} />
        <Kpi label="Pending leave requests" value={leaves.length ? fmt(pendingLeaves) : <NotConnected />} />
        <Kpi label="Documents expiring" value={expiringDocs.length ? fmt(expiringDocs.length) : <NotConnected />} />
      </div>
      <div className="grid">
        <section className="panel c12">
          <header><h2>Employee directory</h2></header>
          <div className="mtd"><span className="src">People on the 2024 to 2026 new-hire and leaver lists</span></div>
          <nav className="crumbs" aria-label="breadcrumb" style={{ marginBottom: 8 }}>
            {crumbs.length ? <Link href="/hr">All</Link> : <span className="cur">All</span>}
            {crumbs.map((c, i) => <span key={c} style={{ display: "contents" }}><i>›</i>{i < crumbs.length - 1 ? <Link href={link("/hr", { h: crumbs.slice(0, i + 1).join("|") })}>{c}</Link> : <span className="cur">{c}</span>}</span>)}
          </nav>
          {!staff.length ? <p className="empty">No staff lists uploaded yet</p> : company && !units.length ? <p className="empty">No departments linked to {company} yet. Add them on the company page under Admin, Companies.</p> : !unit ? (
            <div className="drill">{list.map(([name, count]) => (
              <Link key={name} className="dr" href={link("/hr", { h: [...crumbs, name].join("|") })}>
                <span className="lab">{name}</span>
                <span className="track"><span className="fill" style={{ width: `${(count / biggest) * 100}%` }} /></span>
                <span className="num" style={{ textAlign: "end" }}>{fmt(count)}</span><span className="chev" aria-hidden="true">›</span>
              </Link>))}</div>
          ) : (
            <div className="tw scroll"><table>
              <thead><tr><th>Name</th><th>Employee ID</th><th>Job title</th><th>Nationality</th><th>Joined</th><th>Left</th></tr></thead>
              <tbody>{people.map((e) => <tr key={e.id}><td>{e.name}</td><td>{e.id}</td><td>{e.designation}</td><td>{e.nationality}</td><td>{e.joined}</td><td>{e.left ?? "—"}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
        <Panel span={12} title={`Salesmen · ${MONTHS[o.month]} ${o.year}`}>
          <div className="tw"><table>
            <thead><tr><th>Name</th><th className="n">Sales (QAR)</th><th className="n">Customers</th><th className="n">Documents</th></tr></thead>
            <tbody>{team.map((m) => <tr key={m.name}><td><span className="who"><span className="avatar">{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>{m.name}</span></td><td className="n num">{fmt(m.value)}</td><td className="n num">{m.customers}</td><td className="n num">{fmt(m.docs)}</td></tr>)}</tbody>
          </table></div>
        </Panel>
        <Panel span={7} title={`Joiners and leavers · ${year}`}>
          {staff.length ? (
            <div className="tw"><table>
              <thead><tr><th></th>{MONTHS.map((m) => <th key={m} className="n">{m}</th>)}<th className="n">Total</th></tr></thead>
              <tbody>{([["Joined", moves.joiners], ["Left", moves.leavers]] as const).map(([label, row]) => <tr key={label}><td>{label}</td>{row.map((v, i) => <td key={i} className="n num">{v || "—"}</td>)}<td className="n num">{fmt(row.reduce((a, b) => a + b, 0))}</td></tr>)}</tbody>
            </table></div>
          ) : <p className="empty">No staff lists uploaded yet</p>}
        </Panel>
        <Panel span={5} title={`By company · ${year}`}>
          <div className="tw"><table>
            <thead><tr><th>Company</th><th className="n">Joined</th><th className="n">Left</th></tr></thead>
            <tbody>{byCompany.length ? byCompany.map((d) => <tr key={d.department}><td>{d.department}</td><td className="n num">{d.joiners}</td><td className="n num">{d.leavers}</td></tr>) : <Empty cols={3} text="—" />}</tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Leave requests">
          <div className="tw"><table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th className="n">Days</th><th>Status</th></tr></thead>
            <tbody>
              {leaves.length ? leaves.map((l) => (
                <tr key={l.id}>
                  <td>{l.employeeName}{l.companyName ? <small style={{ display: "block", color: "var(--muted)" }}>{l.companyName}</small> : null}</td>
                  <td>{l.leaveType}</td>
                  <td className="mono">{l.startDate} → {l.endDate}</td>
                  <td className="n num">{fmt(l.days, 1, 0)}</td>
                  <td><span className={`chip ${l.status === "Approved" ? "good" : l.status === "Rejected" ? "bad" : "warn"}`}>{l.status}</span></td>
                </tr>
              )) : <Empty cols={5} text="Not connected" />}
            </tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Expiring documents">
          <div className="tw"><table>
            <thead><tr><th>Holder</th><th>Document</th><th>Expiry</th><th>Status</th></tr></thead>
            <tbody>
              {expiringDocs.length ? expiringDocs.map((d) => (
                <tr key={d.id}>
                  <td>{d.holderName}{d.companyName ? <small style={{ display: "block", color: "var(--muted)" }}>{d.companyName}</small> : null}</td>
                  <td>{d.documentType}{d.documentNo ? <small className="mono" style={{ display: "block", color: "var(--muted)" }}>{d.documentNo}</small> : null}</td>
                  <td className="mono">{d.expiryDate}</td>
                  <td><span className={`chip ${d.status === "Expired" ? "bad" : d.status === "Valid" ? "good" : "warn"}`}>{d.status}</span></td>
                </tr>
              )) : <Empty cols={4} text="Not connected" />}
            </tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
