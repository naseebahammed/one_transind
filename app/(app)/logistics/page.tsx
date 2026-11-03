import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview, getRoutes } from "@/lib/data";
import { fmt, MONTHS, pct } from "@/lib/format";
import { Empty, HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Logistics · One Transind" };

// Fleet, warehouse, shipment and customs sources are not connected: the legacy panels show 0. Routes and drivers come from the sales documents.
const WAREHOUSES = ["Main DC – Industrial Area", "Chilled & frozen – Industrial Area", "Al Wakra", "Abu Hamour", "New Doha store", "Mesaieed", "Manateq – new DC"];

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
        <Kpi label="Fleet" value="0" />
        <Kpi label="On route" value="0" />
        <Kpi label="On-time delivery" value="0%" />
        <Kpi label="Outlets reached" value="0 / 0" />
      </div>
      <div className="grid">
        <Panel span={12} title="Shipments">
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>To</th><th>Temperature</th><th>Vehicle</th><th>ETA</th><th>Status</th></tr></thead>
            <tbody><Empty cols={6} /></tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Warehouses">
          <HBars rows={WAREHOUSES.map((l) => ({ l, v: 0, extra: "0 m²" }))} unit="%" max={100} />
        </Panel>
        <Panel span={6} title="Fleet">
          <div className="tw"><table>
            <thead><tr><th>Type</th><th className="n">Fleet</th><th className="n">On route</th><th className="n">Idle</th><th className="n">Maintenance</th></tr></thead>
            <tbody>{["Dry", "Chilled", "Frozen"].map((t) => <tr key={t}><td>{t}</td><td className="n num">0</td><td className="n num">0</td><td className="n num">0</td><td className="n num">0</td></tr>)}</tbody>
          </table></div>
          <header style={{ marginTop: 18 }}><h2>Customs clearance</h2></header>
          <div className="tw"><table>
            <thead><tr><th>Bill of lading</th><th>Customer</th><th>Status</th></tr></thead>
            <tbody><Empty cols={3} /></tbody>
          </table></div>
        </Panel>
        <Panel span={6} title={`Routes · ${label}`}>
          <div className="tw"><table>
            <thead><tr><th>Route</th><th className="n">Drivers</th><th className="n">Documents</th><th className="n">Sales</th><th className="n">vs prev. month</th></tr></thead>
            <tbody>{d.routes.map((r) => (
              <tr key={r.k}><td>{r.k}</td><td className="n num">{r.drivers}</td><td className="n num">{fmt(r.docs)}</td><td className="n num">{fmt(r.v)}</td>
                <td className={`n num ${pct(r.v, r.lv) >= 0 ? "up" : "down"}`}>{r.lv ? `${fmt(pct(r.v, r.lv), 1)}%` : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
        <Panel span={6} title={`Top drivers · ${label}`}>
          <div className="tw"><table>
            <thead><tr><th>Driver</th><th className="n">Customers</th><th className="n">Documents</th><th className="n">Sales</th></tr></thead>
            <tbody>{d.drivers.map((r) => <tr key={r.name}><td>{r.name}</td><td className="n num">{r.customers}</td><td className="n num">{fmt(r.docs)}</td><td className="n num">{fmt(r.v)}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
