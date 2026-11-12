import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, money } from "@/lib/format";
import { listSettlements } from "@/lib/settlement-records";
import { summarizeSettlements } from "@/lib/settlements";
import { YearSelect } from "@/components/YearSelect";
import { HBars, Kpi, MonthBars, Panel } from "@/components/ui";

export const metadata = { title: "Settlements · One Transind" };
type Params = Promise<{ year?: string }>;

// The settlement codes (AL, FF, TE, LE) are shown as they appear in the sheet until HR confirms what each one means.
export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content searchParams={searchParams} /></Suspense>;
}

async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser();
  const rows = await listSettlements();
  const years = [...new Set(rows.map((s) => Number(s.uploadDate.slice(0, 4))))].sort((a, b) => b - a);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : years[0];
  if (year === undefined) return <p className="empty">No settlements uploaded yet. Upload the file under Admin, Staff lists.</p>;
  const s = summarizeSettlements(rows, year);

  return (
    <>
      <p><Link href="/hr">‹ Human resources</Link></p>
      <YearSelect years={years} value={year} base="/hr/settlements" />
      <div className="kpis">
        <Kpi label={`Paid ${year}`} value={`${money(s.total)} QAR`} />
        <Kpi label="Payments" value={fmt(s.payments)} />
        <Kpi label="People paid" value={fmt(s.people)} />
      </div>
      <div className="grid">
        <Panel span={12} title={`Paid by month · ${year}`} src="QAR, by upload date"><MonthBars series={[s.byMonth]} labels={["Paid"]} /></Panel>
        <Panel span={6} title="By settlement type"><HBars rows={s.byType.map((t) => ({ l: t.name, v: t.total, extra: `${fmt(t.payments)} payments` }))} unit=" M" /></Panel>
        <section className="panel c6">
          <header><h2>By division</h2></header>
          <div className="tw scroll"><table>
            <thead><tr><th>Division</th><th>People</th><th>Payments</th><th>Paid (QAR)</th></tr></thead>
            <tbody>{s.byDivision.map((d) => <tr key={d.name}><td>{d.name}</td><td>{fmt(d.people)}</td><td>{fmt(d.payments)}</td><td>{fmt(d.total)}</td></tr>)}</tbody>
          </table></div>
        </section>
      </div>
    </>
  );
}
