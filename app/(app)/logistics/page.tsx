import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview, getRoutes } from "@/lib/data";
import { fmt, MONTHS, pct } from "@/lib/format";
import { getLogisticsOverview } from "@/lib/manual-report-records";
import { Empty, Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Logistics · One Transind" };

export default function Page() {
  return <Suspense fallback={<p className="empty">Loading…</p>}><Content /></Suspense>;
}

async function Content() {
  await connection();
  await requireUser();
  const [o, logistics] = await Promise.all([getOverview(), getLogisticsOverview()]);
  const d = await getRoutes(o.month);
  const label = `${MONTHS[o.month]} ${d.year}`;
  const { kpis, fleet, shipments, warehouses, customs } = logistics;
  const fleetVal = kpis?.fleetCount ?? (fleet.length ? fleet.length : null);
  const onRouteVal = kpis?.onRouteCount ?? (fleet.length ? fleet.filter((v) => v.status.toLowerCase() === "on route").length : null);
  const outletsVal = kpis?.outletsReached ?? null;

  return (
    <>
      <div className="kpis">
        <Kpi label="Fleet" value={fleetVal !== null ? fmt(fleetVal) : <NotConnected />} />
        <Kpi label="On route" value={onRouteVal !== null ? fmt(onRouteVal) : <NotConnected />} />
        <Kpi label="Outlets reached" value={outletsVal !== null ? fmt(outletsVal) : <NotConnected />} />
      </div>
      <div className="grid">
        <Panel span={12} title="Shipments">
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>To</th><th>Temperature</th><th>Vehicle</th><th>ETA</th><th>Status</th></tr></thead>
            <tbody>
              {shipments.length ? shipments.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.shipmentCode}</td>
                  <td>{s.destination}</td>
                  <td>{s.temperature || "—"}</td>
                  <td>{s.vehicle || "—"}</td>
                  <td>{s.eta || "—"}</td>
                  <td>
                    <span className={`chip ${s.status === "Late" ? "bad" : s.status === "Delivered" || s.status === "On time" ? "good" : "plain"}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              )) : <Empty cols={6} text="Not connected" />}
            </tbody>
          </table></div>
        </Panel>
        <Panel span={6} title="Warehouses">
          {warehouses.length ? (
            <div className="tw"><table>
              <thead><tr><th>Warehouse</th><th>Zone</th><th className="n">Pallets</th><th>Status</th></tr></thead>
              <tbody>{warehouses.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}{w.location ? <small style={{ display: "block", color: "var(--muted)" }}>{w.location}</small> : null}</td>
                  <td>{w.temperatureZone}</td>
                  <td className="n num">{fmt(w.occupiedPallets)} / {fmt(w.capacityPallets)}</td>
                  <td><span className={`chip ${w.status === "Operational" ? "good" : "warn"}`}>{w.status}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : (
            <p className="empty">Not connected</p>
          )}
        </Panel>
        <Panel span={6} title="Fleet">
          {fleet.length ? (
            <div className="tw"><table>
              <thead><tr><th>Vehicle</th><th>Driver</th><th>Route</th><th>Temp</th><th>Status</th></tr></thead>
              <tbody>{fleet.map((v) => (
                <tr key={v.id}>
                  <td className="mono">{v.vehicleNo}{v.vehicleType ? <small style={{ display: "block", color: "var(--muted)" }}>{v.vehicleType}</small> : null}</td>
                  <td>{v.driverName || "—"}</td>
                  <td>{v.route || "—"}</td>
                  <td>{v.temperatureMode}</td>
                  <td><span className={`chip ${v.status === "On route" ? "good" : v.status === "Maintenance" ? "warn" : "plain"}`}>{v.status}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : (
            <p className="empty">Not connected</p>
          )}
          <header style={{ marginTop: 18 }}><h2>Customs clearance</h2></header>
          <div className="tw"><table>
            <thead><tr><th>Bill of lading</th><th>Customer</th><th>Status</th></tr></thead>
            <tbody>
              {customs.length ? customs.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.bolNo}{c.port || c.eta ? <small style={{ display: "block", color: "var(--muted)" }}>{[c.port, c.eta].filter(Boolean).join(" · ")}</small> : null}</td>
                  <td>{c.customer}</td>
                  <td><span className={`chip ${c.status === "Cleared" ? "good" : c.status === "Held" ? "bad" : "warn"}`}>{c.status}</span></td>
                </tr>
              )) : <Empty cols={3} text="Not connected" />}
            </tbody>
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
