import { HourBars } from "@/components/charts";
import { HBars, Kpi, Panel } from "@/components/ui";

export const metadata = { title: "Restaurants · One Transind" };

// No restaurant POS source is connected: brand and branch names are the structure of the legacy page, every figure is 0.
const BRANDS = ["Dunkin", "Baskin Robbins", "Mr. Shawarma", "Burger Stop", "Asian Wok"];
const CHANNELS = ["Dine-in", "Takeaway", "Talabat", "Snoonu", "Own app"];
const BRANCHES = ["Dunkin – The Pearl", "Dunkin – Mall of Qatar", "Baskin Robbins – Villaggio", "Mr. Shawarma – Al Sadd", "Dunkin – West Bay", "Baskin Robbins – Katara", "Dunkin – Hamad Airport", "Mr. Shawarma – Al Wakra"];

export default function Page() {
  return (
    <>
      <div className="kpis">
        <Kpi label="Sales today" value="0 QAR" />
        <Kpi label="Transactions" value="0" />
        <Kpi label="Average ticket" value="0.0 QAR" />
        <Kpi label="Branches online" value="0 / 0" />
      </div>
      <div className="grid">
        <Panel span={7} title="Sales by hour today (QAR k)"><HourBars values={Array(17).fill(0)} /></Panel>
        <Panel span={5} title="Sales today by brand (QAR)">
          <HBars rows={BRANDS.map((l) => ({ l, v: 0, extra: "0 branches" }))} />
          <header style={{ marginTop: 18 }}><h2>Order channel mix</h2></header>
          <HBars rows={CHANNELS.map((l) => ({ l, v: 0 }))} unit="%" max={100} />
        </Panel>
        <Panel span={12} title="Branch performance">
          <div className="tw"><table>
            <thead><tr><th>Branch</th><th className="n">Sales today</th><th style={{ width: "40%" }}>vs target</th></tr></thead>
            <tbody>{BRANCHES.map((b) => <tr key={b}><td>{b}</td><td className="n num">0</td><td><div className="hbar" style={{ gridTemplateColumns: "1fr auto" }}><span className="track"><span className="fill warn" style={{ display: "block", width: 0 }} /></span><span className="num">0%</span></div></td></tr>)}</tbody>
          </table></div>
          <p className="note" style={{ marginTop: 8 }}>The trading sales database has no restaurant data. Figures appear once the POS feed for Baskin Robbins, Dunkin and Mr. Shawarma is connected.</p>
        </Panel>
      </div>
    </>
  );
}
