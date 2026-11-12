import { fmt } from "@/lib/format";
import { listTenancies, summarizeTenancy } from "@/lib/tenancy";
import { Panel } from "@/components/ui";

/** Occupied, empty and upcoming-empty units per residential building, worked out from the uploaded occupancy workbook as of today. */
export async function TenancyPanels() {
  const all = await listTenancies().catch(() => []); // the table does not exist until the migration has run on this database
  if (!all.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const buildings = [...Map.groupBy(all, (r) => r.companyId)].map(([, rows]) => ({ name: rows[0].company, summary: summarizeTenancy(rows, today) }));
  const within = (s: (typeof buildings)[number]["summary"], days: number) => s.ending.filter((r) => r.daysLeft <= days).length;
  const total = (pick: (s: (typeof buildings)[number]["summary"]) => number) => buildings.reduce((n, b) => n + pick(b.summary), 0);
  const share = (occupied: number, units: number) => (units ? `${fmt((occupied / units) * 100, 1)}%` : "—");

  const attention = buildings.flatMap((b) => [
    ...b.summary.vacantUnits.map((r) => ({ building: b.name, unit: r.unit, status: r.contractStart && b.summary.preLet.includes(r) ? `Empty, new contract from ${r.contractStart}` : "Empty", tenant: "", end: "", rent: r.rent, order: -1 })),
    ...b.summary.ended.map((r) => ({ building: b.name, unit: r.unit, status: "Contract ended", tenant: r.tenant ?? "", end: r.contractEnd ?? "", rent: r.rent, order: -0.5 })),
    ...b.summary.ending.filter((r) => r.daysLeft <= 60).map((r) => ({ building: b.name, unit: r.unit, status: `Ends in ${r.daysLeft} days`, tenant: r.tenant ?? "", end: r.contractEnd ?? "", rent: r.rent, order: r.daysLeft })),
  ]).sort((a, b) => a.order - b.order || a.building.localeCompare(b.building));

  return (
    <>
      <Panel span={12} title="Occupancy by building" src={`Units · as of ${today}`}>
        <div className="tw"><table className="cmp">
          <thead><tr><th>Building</th><th className="n">Units</th><th className="n">Occupied</th><th className="n">Occupancy</th><th className="n">Empty now</th><th className="n">Ending in 30 days</th><th className="n">in 60 days</th><th className="n">in 90 days</th></tr></thead>
          <tbody>{buildings.map(({ name, summary: s }) => (
            <tr key={name}><td>{name}</td><td className="n num">{s.total}</td><td className="n num">{s.occupied}</td><td className="n num">{share(s.occupied, s.total)}</td><td className="n num">{s.vacant}</td>
              <td className="n num">{within(s, 30)}</td><td className="n num">{within(s, 60)}</td><td className="n num">{within(s, 90)}</td></tr>
          ))}</tbody>
          <tfoot><tr><td>Total</td><td className="n num">{total((s) => s.total)}</td><td className="n num">{total((s) => s.occupied)}</td><td className="n num">{share(total((s) => s.occupied), total((s) => s.total))}</td><td className="n num">{total((s) => s.vacant)}</td>
            <td className="n num">{total((s) => within(s, 30))}</td><td className="n num">{total((s) => within(s, 60))}</td><td className="n num">{total((s) => within(s, 90))}</td></tr></tfoot>
        </table></div>
        <p className="note" style={{ marginTop: 8 }}>Ending counts are units whose contract ends within that many days; the 60-day and 90-day columns include the earlier ones. A unit whose contract end date has passed but still has a tenant listed counts as occupied and is listed below as "Contract ended".</p>
      </Panel>
      {!!attention.length && (
        <Panel span={12} title="Empty and upcoming-empty units" src="Empty now, contract ended, and ending within 60 days">
          <div className="tw"><table>
            <thead><tr><th>Building</th><th>Unit</th><th>Status</th><th>Tenant</th><th>Contract end</th><th className="n">Rent / month (QAR)</th></tr></thead>
            <tbody>{attention.map((r) => <tr key={`${r.building}|${r.unit}|${r.status}`}><td>{r.building}</td><td>{r.unit}</td><td>{r.status}</td><td>{r.tenant || "—"}</td><td>{r.end || "—"}</td><td className="n num">{r.rent ? fmt(r.rent) : "—"}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      )}
    </>
  );
}
