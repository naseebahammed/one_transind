import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview, getRoutes } from "@/lib/data";
import { fmt, MONTHS, pct } from "@/lib/format";
import { Empty, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Logistics · One Transind" };

// Fleet, warehouse, shipment and customs sources are not connected. Routes and drivers come from the sales documents.

export default function Page() {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content /></Suspense>;
}

async function Content() {
  await connection();
  const o = await getOverview();
  const d = await getRoutes(o.month);
  const label = `${MONTHS[o.month]} ${d.year}`;
  return (
    <>
      <div className="kpis">
        <Kpi label="Fleet" value={<NotConnected />} />
        <Kpi label="On route" value={<NotConnected />} />
        <Kpi label="On-time delivery" value={<NotConnected />} />
        <Kpi label="Outlets reached" value={<NotConnected />} />
      </div>
      <div className="grid">
        <Panel span={12} title="Shipments">
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>To</th><th>Temperature</th><th>Vehicle</th><th>ETA</th><th>Status</th></tr></thead>
            <tbody><Empty cols={6} text="Not connected" /></tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Warehouses">
          <p className="empty">Not connected</p>
        </Panel>
        <Panel span={6} title="Fleet">
          <p className="empty">Not connected</p>
          <header style={{ marginTop: 18 }}><h2>Customs clearance</h2></header>
          <div className="tw"><table>
            <thead><tr><th>Bill of lading</th><th>Customer</th><th>Status</th></tr></thead>
            <tbody><Empty cols={3} text="Not connected" /></tbody>
          </table></div>
        </Panel>
        <Panel span={6} title={`Routes · ${label}`}>
          <div className="tw"><table>
            <thead><tr><th>Route</th><th className="n">Drivers</th><th className="n">Documents</th><th className="n">Sales</th><th className="n">vs prev. month</th></tr></thead>
            <tbody>{d.routes.map((r) => (
              <tr key={r.key}><td>{r.key}</td><td className="n num">{r.drivers}</td><td className="n num">{fmt(r.docs)}</td><td className="n num">{fmt(r.value)}</td>
                <td className={`n num ${pct(r.value, r.lastMonth) >= 0 ? "up" : "down"}`}>{r.lastMonth ? `${fmt(pct(r.value, r.lastMonth), 1)}%` : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
        <Panel span={6} title={`Top drivers · ${label}`}>
          <div className="tw"><table>
            <thead><tr><th>Driver</th><th className="n">Customers</th><th className="n">Documents</th><th className="n">Sales</th></tr></thead>
            <tbody>{d.drivers.map((r) => <tr key={r.name}><td>{r.name}</td><td className="n num">{r.customers}</td><td className="n num">{fmt(r.docs)}</td><td className="n num">{fmt(r.value)}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
