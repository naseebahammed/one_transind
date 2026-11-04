import { Kpi, NotConnected, Panel } from "@/components/ui";

export const metadata = { title: "Restaurants · One Transind" };

// No restaurant POS source is connected, so the page shows no figures.
export default function Page() {
  return (
    <>
      <div className="kpis">
        <Kpi label="Sales today" value={<NotConnected />} />
        <Kpi label="Transactions" value={<NotConnected />} />
        <Kpi label="Average ticket" value={<NotConnected />} />
        <Kpi label="Branches online" value={<NotConnected />} />
      </div>
      <div className="grid">
        <Panel span={7} title="Sales by hour today"><p className="empty">Not connected</p></Panel>
        <Panel span={5} title="Sales today by brand and order channel"><p className="empty">Not connected</p></Panel>
        <Panel span={12} title="Branch performance">
          <p className="empty">Not connected</p>
          <p className="note" style={{ marginTop: 8 }}>The trading sales database has no restaurant data. Figures appear once the POS feed for Baskin Robbins, Dunkin and Mr. Shawarma is connected.</p>
        </Panel>
      </div>
    </>
  );
}
