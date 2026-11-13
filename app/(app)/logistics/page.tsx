import { requireUser } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { getOverview, getRoutes } from "@/lib/data";
import { fmt, MONTHS, money, pct } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { getLogisticsOverview } from "@/lib/manual-report-records";
import { getWarehouseSummary } from "@/lib/warehouse-summary";
import { Kpi, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/PageSkeleton";

export const metadata = { title: "Logistics · One Transind" };

export default function Page() {
  return <Suspense fallback={<PageSkeleton kpis={4} panels={2} />}><Content /></Suspense>;
}

async function Content() {
  await connection();
  await requireUser("logistics");
  const translate = translator(await getLanguage());
  const [o, logistics, warehouseSummary] = await Promise.all([
    getOverview(),
    getLogisticsOverview(),
    getWarehouseSummary(),
  ]);
  const d = await getRoutes(o.month);
  const label = `${MONTHS[o.month]} ${d.year}`;
  const { kpis, fleet, shipments, warehouses, customs } = logistics;
  const fleetVal = kpis?.fleetCount ?? (fleet.length ? fleet.length : null);
  const onRouteVal = kpis?.onRouteCount ?? (fleet.length ? fleet.filter((v) => v.status.toLowerCase() === "on route").length : null);
  const outletsFromErp = d.outletsReached > 0 ? d.outletsReached : null;
  const outletsVal = kpis?.outletsReached ?? outletsFromErp;
  const hasFmcgStock = warehouseSummary.locations.length > 0;
  const hasExpiry = warehouseSummary.locations.some((loc) => loc.expiringCost90d > 0);
  // Keep the panels short: show the biggest 8 stock locations and fold the rest into one "Other" row.
  const TOP_ROWS = 8;
  const topLocations = warehouseSummary.locations.slice(0, TOP_ROWS);
  const otherLocations = warehouseSummary.locations.slice(TOP_ROWS);
  const sumOther = (pick: (loc: (typeof otherLocations)[number]) => number) => otherLocations.reduce((total, loc) => total + pick(loc), 0);

  return (
    <>
      <div className="kpis">
        {fleetVal !== null && <Kpi label={translate("Fleet")} value={fmt(fleetVal)} />}
        {onRouteVal !== null && <Kpi label={translate("On route")} value={fmt(onRouteVal)} />}
        {outletsVal !== null && (
          <Kpi
            label={translate("Outlets reached")}
            value={fmt(outletsVal)}
            delta={kpis?.outletsReached == null ? `${translate("Delivered")} · ${label}` : undefined}
          />
        )}
        {d.activeDrivers > 0 && <Kpi label={translate("Active drivers")} value={fmt(d.activeDrivers)} delta={`${translate("ERP sales")} · ${label}`} />}
        {hasFmcgStock && <Kpi label={translate("Short deliveries")} value={fmt(warehouseSummary.shortDeliveryOrders)} delta={translate("Orders · last 30 days")} />}
      </div>
      <div className="grid">
        {shipments.length > 0 && <Panel span={12} title={translate("Shipments")}>
          <div className="tw"><table className="sticky-col">
            <thead><tr><th>{translate("ID")}</th><th>{translate("To")}</th><th>{translate("Temperature")}</th><th>{translate("Vehicle")}</th><th>{translate("ETA")}</th><th>{translate("Status")}</th></tr></thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.shipmentCode}</td>
                  <td>{s.destination}</td>
                  <td>{s.temperature || "—"}</td>
                  <td>{s.vehicle || "—"}</td>
                  <td>{s.eta || "—"}</td>
                  <td>
                    <span className={`chip ${s.status === "Late" ? "bad" : s.status === "Delivered" || s.status === "On time" ? "good" : "plain"}`}>
                      {translate(s.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Panel>}
        {(hasFmcgStock || warehouses.length > 0) && <Panel
          span={12}
          title={translate("Warehouses")}
          src={hasFmcgStock && warehouseSummary.latestAsOf ? `${translate("FMCG stock")} · ${translate("As of")} ${warehouseSummary.latestAsOf}` : undefined}
        >
          {hasFmcgStock && (
            <div className="tw compact"><table>
              <thead>
                <tr>
                  <th>{translate("Location")}</th>
                  <th className="n">{translate("SKUs")}</th>
                  <th className="n">{translate("Balance qty")}</th>
                  <th className="n">{translate("Allocated qty")}</th>
                  <th className="n">{translate("Value (QAR)")}</th>
                  <th className="n">{translate("Short deliveries (30d)")}</th>
                  {hasExpiry && <th className="n">{translate("Expiring ≤90d")}</th>}
                </tr>
              </thead>
              <tbody>
                {topLocations.map((loc) => (
                  <tr key={loc.location}>
                    <td>{loc.location}</td>
                    <td className="n num">{fmt(loc.itemCount)}</td>
                    <td className="n num">{fmt(loc.qtyBalance)}</td>
                    <td className="n num">{fmt(loc.qtyAllocated)}</td>
                    <td className="n num">{money(loc.stockValue)}</td>
                    <td className="n num">{loc.shortDeliveryValue > 0 ? money(loc.shortDeliveryValue) : "—"}</td>
                    {hasExpiry && <td className="n num">{loc.expiringCost90d > 0 ? money(loc.expiringCost90d) : "—"}</td>}
                  </tr>
                ))}
                {otherLocations.length > 0 && (
                  <tr>
                    <td>{translate("Other")} ({otherLocations.length} {translate("locations")})</td>
                    <td className="n num">{fmt(sumOther((loc) => loc.itemCount))}</td>
                    <td className="n num">{fmt(sumOther((loc) => loc.qtyBalance))}</td>
                    <td className="n num">{fmt(sumOther((loc) => loc.qtyAllocated))}</td>
                    <td className="n num">{money(sumOther((loc) => loc.stockValue))}</td>
                    <td className="n num">{sumOther((loc) => loc.shortDeliveryValue) > 0 ? money(sumOther((loc) => loc.shortDeliveryValue)) : "—"}</td>
                    {hasExpiry && <td className="n num">{sumOther((loc) => loc.expiringCost90d) > 0 ? money(sumOther((loc) => loc.expiringCost90d)) : "—"}</td>}
                  </tr>
                )}
              </tbody>
            </table></div>
          )}
          {warehouses.length > 0 && (
            <div className="tw" style={hasFmcgStock ? { marginTop: 14 } : undefined}><table>
              <thead><tr><th>{translate("Warehouse")}</th><th>{translate("Zone")}</th><th className="n">{translate("Pallets")}</th><th>{translate("Status")}</th></tr></thead>
              <tbody>{warehouses.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}{w.location ? <small style={{ display: "block", color: "var(--muted)" }}>{w.location}</small> : null}</td>
                  <td>{w.temperatureZone}</td>
                  <td className="n num">{fmt(w.occupiedPallets)} / {fmt(w.capacityPallets)}</td>
                  <td><span className={`chip ${w.status === "Operational" ? "good" : "warn"}`}>{translate(w.status)}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>}
        {(fleet.length > 0 || customs.length > 0) && <Panel span={6} title={fleet.length ? translate("Fleet") : translate("Customs clearance")}>
          {fleet.length > 0 && (
            <div className="tw"><table>
              <thead><tr><th>{translate("Vehicle")}</th><th>{translate("Driver")}</th><th>{translate("Route")}</th><th>{translate("Temp")}</th><th>{translate("Status")}</th></tr></thead>
              <tbody>{fleet.map((v) => (
                <tr key={v.id}>
                  <td className="mono">{v.vehicleNo}{v.vehicleType ? <small style={{ display: "block", color: "var(--muted)" }}>{v.vehicleType}</small> : null}</td>
                  <td>{v.driverName || "—"}</td>
                  <td>{v.route || "—"}</td>
                  <td>{v.temperatureMode}</td>
                  <td><span className={`chip ${v.status === "On route" ? "good" : v.status === "Maintenance" ? "warn" : "plain"}`}>{translate(v.status)}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {customs.length > 0 && <>
          {fleet.length > 0 && <header style={{ marginTop: 18 }}><h2>{translate("Customs clearance")}</h2></header>}
          <div className="tw"><table>
            <thead><tr><th>{translate("Bill of lading")}</th><th>{translate("Customer")}</th><th>{translate("Status")}</th></tr></thead>
            <tbody>
              {customs.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.bolNo}{c.port || c.eta ? <small style={{ display: "block", color: "var(--muted)" }}>{[c.port, c.eta].filter(Boolean).join(" · ")}</small> : null}</td>
                  <td>{c.customer}</td>
                  <td><span className={`chip ${c.status === "Cleared" ? "good" : c.status === "Held" ? "bad" : "warn"}`}>{translate(c.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          </>}
        </Panel>}
        <Panel span={6} title={`${translate("Routes")} · ${label}`}>
          <div className="tw"><table>
            <thead><tr><th>{translate("Route")}</th><th className="n">{translate("Drivers")}</th><th className="n">{translate("Documents")}</th><th className="n">{translate("Sales")}</th><th className="n">{translate("vs prev. month")}</th></tr></thead>
            <tbody>{d.routes.map((r) => (
              <tr key={r.key}><td>{r.key}</td><td className="n num">{r.drivers}</td><td className="n num">{fmt(r.docs)}</td><td className="n num">{fmt(r.value)}</td>
                <td className={`n num ${pct(r.value, r.lastMonth) >= 0 ? "up" : "down"}`}>{r.lastMonth ? `${fmt(pct(r.value, r.lastMonth), 1)}%` : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
        <Panel span={6} title={`${translate("Top drivers")} · ${label}`}>
          <div className="tw compact"><table>
            <thead><tr><th>{translate("Driver")}</th><th className="n">{translate("Customers")}</th><th className="n">{translate("Documents")}</th><th className="n">{translate("Sales")}</th></tr></thead>
            <tbody>{d.drivers.slice(0, TOP_ROWS).map((r) => <tr key={r.name}><td>{r.name}</td><td className="n num">{r.customers}</td><td className="n num">{fmt(r.docs)}</td><td className="n num">{fmt(r.value)}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
