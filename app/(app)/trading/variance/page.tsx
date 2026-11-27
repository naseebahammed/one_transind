import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/guard";
import { fmt, sum } from "@/lib/format";
import { Kpi, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";
import report from "@/data/variance-report.json";

export const metadata = { title: "Invoice vs delivery variance · One Transind" };
export const instant = false; // lets the build treat this signed-in page as blocking; same setting as app/page.tsx

type Group = { name: string; invoiced: number; delivered: number; variance: number; lines: number };

// Variance = invoiced (RV) minus delivered (DO): goods invoiced but not yet delivered. Data comes from the monthly workbook via scripts/import-variance-report.mjs.
function Table({ title, rows }: { title: string; rows: Group[] }) {
  return (
    <Panel span={6} title={title} src={report.month}>
      <div className="tw"><table>
        <thead><tr><th>Name</th><th className="n">Invoiced (QAR)</th><th className="n">Delivered (QAR)</th><th className="n">Variance (QAR)</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td className="n num">{fmt(r.invoiced)}</td><td className="n num">{fmt(r.delivered)}</td><td className="n num">{fmt(r.variance)}</td></tr>)}</tbody>
      </table></div>
    </Panel>
  );
}

// The sign-in check reads request headers, so it must sit inside Suspense or the production build fails.
export default function Page() {
  return <Suspense fallback={<PageSkeleton kpis={3} panels={3} />}><Content /></Suspense>;
}

async function Content() {
  await connection();
  await requireUser("trading");
  const invoiced = sum(report.bySupervisor.map((r) => r.invoiced)), delivered = sum(report.bySupervisor.map((r) => r.delivered));
  return (
    <>
      <h2>Invoice vs delivery variance · {report.month}</h2>
      <div className="kpis">
        <Kpi label="Invoiced (QAR)" value={fmt(invoiced)} />
        <Kpi label="Delivered (QAR)" value={fmt(delivered)} />
        <Kpi label="Variance (QAR)" value={fmt(invoiced - delivered)} />
      </div>
      <div className="grid">
        <Table title="By supervisor" rows={report.bySupervisor} />
        <Table title="By brand" rows={report.byBrand} />
        <Table title="Top 20 customers" rows={report.byCustomer} />
      </div>
    </>
  );
}
