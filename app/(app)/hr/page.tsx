import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getOverview, getSalesmen } from "@/lib/data";
import { fmt, MONTHS } from "@/lib/format";
import { DEPTS, JOBS, SECTORS, SECTOR } from "@/lib/org";
import { link, parsePath } from "@/lib/url";
import { Empty, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Human resources · One Transind" };
type Params = Promise<{ h?: string }>;

// No HR source is connected: the organisation structure is the legacy one, with no headcounts.
export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  const { h } = await searchParams;
  const p = parsePath(h);
  const o = await getOverview();
  const team = await getSalesmen(o.month);
  const sec = SECTORS.find((s) => s[0] === p[0]);
  const deptIdx = Number.isInteger(+p[1]) && +p[1] >= 0 && +p[1] < DEPTS.length ? +p[1] : -1;
  const jobs = sec && deptIdx >= 0 ? JOBS[sec[0]]?.[deptIdx] : undefined;
  const rows: { k: string; l: string; sub?: string }[] | null =
    p.length === 0 ? SECTORS.map((s) => ({ k: s[0], l: s[1], sub: DEPTS.join(" · ") }))
    : p.length === 1 && sec ? DEPTS.map((d, i) => ({ k: String(i), l: d, sub: JOBS[sec[0]]?.[i]?.join(", ") }))
    : p.length === 2 && jobs ? jobs.map((j, i) => ({ k: String(i), l: j })) : null;
  const level = ["Sectors", "Departments", "Job titles", "Employees"][Math.min(p.length, 3)];
  const crumbs = [sec?.[1] ?? p[0], DEPTS[deptIdx] ?? p[1], jobs?.[+p[2]] ?? p[2]];

  return (
    <>
      <div className="kpis">
        <Kpi label="Employees" value={<NotConnected />} />
        <Kpi label="Sales staff" value={<NotConnected />} />
        <Kpi label="Maintenance staff" value={<NotConnected />} />
        <Kpi label="Pending leave requests" value={<NotConnected />} />
        <Kpi label="Documents expiring" value={<NotConnected />} />
      </div>
      <div className="grid">
        <section className="panel c12">
          <header><h2>Employee directory</h2></header>
          <div className="mtd"><NotConnected /><span className="src">Employees</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <nav className="crumbs" aria-label="breadcrumb">
              {p.length ? <Link href="/hr">All</Link> : <span className="cur">All</span>}
              {p.map((_, i) => <span key={i} style={{ display: "contents" }}><i>›</i>{i < p.length - 1 ? <Link href={link("/hr", { h: p.slice(0, i + 1).join("|") })}>{crumbs[i]}</Link> : <span className="cur">{crumbs[i]}</span>}</span>)}
            </nav>
            <span className="src">{level}{rows ? " · click any row to drill down" : ""}</span>
          </div>
          {rows ? (
            <div className="drill">{rows.map((r) => (
              <Link key={r.k} className="dr" href={link("/hr", { h: [...p, r.k].join("|") })}>
                <span className="lab">{r.l}{r.sub && <small>{r.sub}</small>}</span>
                <span className="track"><span className="fill" style={{ width: "1%" }} /></span>
                <span className="num" style={{ textAlign: "end" }}>—</span><span className="chev" aria-hidden="true">›</span>
              </Link>))}</div>
          ) : (
            <div className="tw scroll"><table>
              <thead><tr><th>Name</th><th>Employee ID</th><th>Job title</th><th>Department</th><th>Location</th><th>Nationality</th><th>Joined</th></tr></thead>
              <tbody><Empty cols={7} text="Not connected" /></tbody>
            </table></div>
          )}
        </section>
        {p[0] === SECTOR.fmcg && (
          <Panel span={12} title={`Salesmen · ${MONTHS[o.month]} ${o.year}`}>
            <div className="tw"><table>
              <thead><tr><th>Name</th><th className="n">Sales (QAR)</th><th className="n">Customers</th><th className="n">Documents</th></tr></thead>
              <tbody>{team.map((m) => <tr key={m.name}><td><span className="who"><span className="avatar">{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>{m.name}</span></td><td className="n num">{fmt(m.value)}</td><td className="n num">{m.customers}</td><td className="n num">{fmt(m.docs)}</td></tr>)}</tbody>
            </table></div>
          </Panel>
        )}
        <Panel span={5} title="Maintenance staff by sector"><p className="empty">Not connected</p></Panel>
        <Panel span={7} title="Leave requests">
          <div className="tw"><table>
            <thead><tr><th>Name</th><th>Sector</th><th>Type</th><th>From</th><th className="n">Days</th><th>Status</th></tr></thead>
            <tbody><Empty cols={6} text="Not connected" /></tbody>
          </table></div>
        </Panel>
        <Panel span={12} title="Documents expiring">
          <div className="tw"><table>
            <thead><tr><th>Name</th><th>Sector</th><th>Document</th><th>Expires</th><th className="n">Left</th></tr></thead>
            <tbody><Empty cols={5} text="Not connected" /></tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
