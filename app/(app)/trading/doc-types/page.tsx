import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { fmt, sum } from "@/lib/format";
import { link } from "@/lib/url";
import { getDocTypeTotals } from "@/lib/doc-type-report";
import { parseRange } from "@/lib/doc-type-report-helpers";
import { Kpi, MarginChip, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Sales by document type · One Transind" };
type Params = Promise<{ from?: string; to?: string; unfinalized?: string }>;

export default function Page({ searchParams }: { searchParams: Params }) {
  return <Suspense fallback={<PageSkeleton kpis={3} hasFilters panels={1} />}><Content searchParams={searchParams} /></Suspense>;
}

// Revenue is positive and costs negative in the ERP, so returns (CR, DR) show as negative values and the total already nets them out.
async function Content({ searchParams }: { searchParams: Params }) {
  await connection();
  await requireUser("trading");
  const { from, to, unfinalized } = await searchParams;
  const includeUnfinalized = unfinalized === "1";
  const now = new Date();
  const range = parseRange(from, to, now);
  const rows = await getDocTypeTotals(range, includeUnfinalized);
  const keep = includeUnfinalized ? "1" : undefined;
  const value = sum(rows.map((r) => r.value)), cost = sum(rows.map((r) => r.cost));
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
  const yesterday = parseRange(undefined, undefined, now).from;
  const label = range.from === range.to ? range.from : `${range.from} to ${range.to}`;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginInlineEnd: "auto" }}>Sales by document type · {label}</h2>
        <Link href={link("/trading/doc-types", { from: yesterday, to: yesterday, unfinalized: keep })}>Yesterday</Link>
        <Link href={link("/trading/doc-types", { from: monthStart, to: yesterday, unfinalized: keep })}>This month</Link>
        <form action="/trading/doc-types" style={{ display: "flex", gap: 6 }}>
          <input type="date" name="from" defaultValue={range.from} min="2026-01-01" aria-label="From date" />
          <input type="date" name="to" defaultValue={range.to} min="2026-01-01" aria-label="To date" />
          <label><input type="checkbox" name="unfinalized" value="1" defaultChecked={includeUnfinalized} /> Include not finalized</label>
          <button type="submit">Show</button>
        </form>
      </div>
      <div className="kpis">
        <Kpi label="Net value (QAR)" value={fmt(value)} />
        <Kpi label="Net cost (QAR)" value={fmt(cost)} />
        <Kpi label="Margin (QAR)" value={fmt(value - cost)} delta={`${fmt(value ? (value - cost) / value * 100 : 0, 1)}%`} />
      </div>
      <div className="grid">
        <Panel span={12} title="Document types" src={`Without tax, from 2026, ${includeUnfinalized ? "all statuses" : "finalized only"}`}>
          <div className="tw"><table>
            <thead><tr><th>Type</th><th className="n">Value (QAR)</th><th className="n">Cost (QAR)</th><th className="n">Margin (QAR)</th><th className="n">Margin %</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.docType}><td>{r.docType}</td><td className="n num">{fmt(r.value)}</td><td className="n num">{fmt(r.cost)}</td><td className="n num">{fmt(r.value - r.cost)}</td><td className="n"><MarginChip s={r.value} c={r.cost} /></td></tr>)}
              <tr><td><b>Total</b></td><td className="n num"><b>{fmt(value)}</b></td><td className="n num"><b>{fmt(cost)}</b></td><td className="n num"><b>{fmt(value - cost)}</b></td><td className="n"><MarginChip s={value} c={cost} /></td></tr>
            </tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
