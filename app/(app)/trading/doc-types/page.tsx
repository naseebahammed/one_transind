import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, sum } from "@/lib/format";
import { link } from "@/lib/url";
import { getDepartmentTotals, getDocTypeTotals } from "@/lib/doc-type-report";
import { parseRange } from "@/lib/doc-type-report-helpers";
import { Kpi, MarginChip, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Sales by document type · One Transind" };
type Params = Promise<{ from?: string; to?: string; finalized?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={3} hasFilters panels={1} />}><Content searchParams={searchParams} /></Suspense>;
}

// Revenue is positive and costs negative in the ERP, so returns (CR, DR) show as negative values and the total already nets them out.
async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("trading");
  const { from, to, finalized } = await searchParams;
  const finalizedOnly = finalized === "1";
  const keep = finalizedOnly ? "1" : undefined;
  const now = new Date();
  const range = parseRange(from, to, now);
  const [rows, departments] = await Promise.all([getDocTypeTotals(range, finalizedOnly), getDepartmentTotals(range, finalizedOnly)]);
  const value = sum(rows.map((r) => r.value)), cost = sum(rows.map((r) => r.cost));
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
  const yesterday = parseRange(undefined, undefined, now).from;
  const label = range.from === range.to ? range.from : `${range.from} to ${range.to}`;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginInlineEnd: "auto" }}>Sales by document type · {label}</h2>
        <Link href={link("/trading/doc-types", { from: yesterday, to: yesterday, finalized: keep })}>Yesterday</Link>
        <Link href={link("/trading/doc-types", { from: monthStart, to: yesterday, finalized: keep })}>This month</Link>
        <form action="/trading/doc-types" style={{ display: "flex", gap: 6 }}>
          <input type="date" name="from" defaultValue={range.from} aria-label="From date" />
          <input type="date" name="to" defaultValue={range.to} aria-label="To date" />
          <label><input type="checkbox" name="finalized" value="1" defaultChecked={finalizedOnly} /> Finalized only</label>
          <button type="submit">Show</button>
        </form>
      </div>
      <div className="kpis">
        <Kpi label="Net value (QAR)" value={fmt(value)} />
        <Kpi label="Net cost (QAR)" value={fmt(cost)} />
        <Kpi label="Margin (QAR)" value={fmt(value - cost)} delta={`${fmt(value ? (value - cost) / value * 100 : 0, 1)}%`} />
      </div>
      <div className="grid">
        <Panel span={12} title="Document types" src={`Without tax, ${finalizedOnly ? "finalized only" : "finalized and converted"}`}>
          <div className="tw"><table>
            <thead><tr><th>Type</th><th className="n">Value (QAR)</th><th className="n">Cost (QAR)</th><th className="n">Margin (QAR)</th><th className="n">Margin %</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.docType}><td>{r.docType}</td><td className="n num">{fmt(r.value)}</td><td className="n num">{fmt(r.cost)}</td><td className="n num">{fmt(r.value - r.cost)}</td><td className="n"><MarginChip s={r.value} c={r.cost} /></td></tr>)}
              <tr><td><b>Total</b></td><td className="n num"><b>{fmt(value)}</b></td><td className="n num"><b>{fmt(cost)}</b></td><td className="n num"><b>{fmt(value - cost)}</b></td><td className="n"><MarginChip s={value} c={cost} /></td></tr>
            </tbody>
          </table></div>
        </Panel>
        <Panel span={12} title="By department" src="Same total as above">
          <div className="tw"><table>
            <thead><tr><th>Department</th><th className="n">Value (QAR)</th><th className="n">Cost (QAR)</th><th className="n">Margin (QAR)</th><th className="n">Margin %</th><th className="n">Share</th></tr></thead>
            <tbody>
              {departments.map((d) => <tr key={d.code}><td>{d.name}{d.name !== d.code && ` (${d.code})`}</td><td className="n num">{fmt(d.value)}</td><td className="n num">{fmt(d.cost)}</td><td className="n num">{fmt(d.value - d.cost)}</td><td className="n"><MarginChip s={d.value} c={d.cost} /></td><td className="n num">{fmt(value ? d.value / value * 100 : 0, 1)}%</td></tr>)}
              <tr><td><b>Total</b></td><td className="n num"><b>{fmt(sum(departments.map((d) => d.value)))}</b></td><td className="n num"><b>{fmt(sum(departments.map((d) => d.cost)))}</b></td><td className="n num"><b>{fmt(sum(departments.map((d) => d.value - d.cost)))}</b></td><td className="n"></td><td className="n num"><b>100%</b></td></tr>
            </tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
