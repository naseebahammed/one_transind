import type { ReactNode } from "react";
import { fmt, MONTHS, pct } from "@/lib/format";
import { Spark } from "@/components/charts";
import { ChartTip } from "@/components/ChartTip";
import { tip } from "@/lib/tip";

export const Panel = ({ title, src, span, children }: { title: ReactNode; src?: ReactNode; span?: number; children: ReactNode }) => (
  <section className={`panel${span ? ` c${span}` : ""}`}>
    <header><h2>{title}</h2>{src != null && <span className="src">{src}</span>}</header>
    {children}
  </section>
);

export const Kpi = ({ label, value, delta, up, spark }: { label: ReactNode; value: ReactNode; delta?: ReactNode; up?: boolean; spark?: number[] }) => (
  <div className="kpi">
    <span className="l">{label}</span>
    <span className="v">{value}</span>
    {delta && <span className={`d ${up ? "up" : "down"}`}>{delta}</span>}
    {spark && <Spark id={`sg-${String(label).replace(/\W/g, "")}`} data={spark} />}
  </div>
);

/** Year-over-year or month-over-month delta as in the legacy app. */
export const Delta = ({ a, b, small }: { a: number; b: number; small?: boolean }) => {
  const c = pct(a, b);
  return <span className={c >= 0 ? "up" : "down"} style={{ fontSize: small ? 11 : 12.5 }}>{c >= 0 ? "▲" : "▼"} {fmt(Math.abs(c), 1)}%</span>;
};

/** Gross-margin chip, coloured like the legacy trading page. */
export const MarginChip = ({ s, c }: { s: number; c: number }) => {
  const m = s ? (s - c) / s * 100 : 0;
  return <span className={`chip ${m >= 30 ? "good" : m >= 15 ? "plain" : m >= 5 ? "warn" : "bad"}`} style={{ fontSize: 10.5 }}><span className="num">{fmt(m, 1)}%</span></span>;
};

export const Insights = ({ title, src, items }: { title: string; src?: string; items: [string, string][] }) => (
  <Panel span={12} title={title} src={src}>
    <div className="conn">{items.map(([k, text], i) => (
      <div className="panel" key={i} style={{ background: "rgba(255,255,255,.02)" }}>
        <span><span className={`chip ${k}`}>{k === "good" ? "▲" : k === "bad" ? "▼" : k === "warn" ? "!" : "i"}</span></span>
        <p style={{ color: "var(--text)", marginTop: 6 }}>{text}</p>
      </div>
    ))}</div>
  </Panel>
);

/** Stands in for a figure with no data source, so it never reads as a real 0. */
export const NotConnected = () => <span style={{ fontSize: 15, color: "var(--muted)" }}>Not connected</span>;

export const Empty = ({ cols, text = "—" }: { cols: number; text?: string }) => <tr><td colSpan={cols} className="empty">{text}</td></tr>;

export const Change = ({ pct }: { pct: number }) => (
  <span className={`d ${pct >= 0 ? "up" : "down"}`}>{pct >= 0 ? "▲" : "▼"} {fmt(Math.abs(pct), 1)}%</span>
);

export function HBars({ rows, unit = "", max: fixed }: { rows: { l: string; v: number; extra?: string; cls?: string }[]; unit?: string; max?: number }) {
  const max = fixed || Math.max(1, ...rows.map((r) => r.v));
  if (!rows.length) return <p className="empty">—</p>;
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.l} title={r.extra}>
          <span className="lab">{r.l}</span>
          <span className="track"><span className={`fill ${r.cls ?? ""}`} style={{ display: "block", width: `${Math.max(1, Math.max(0, r.v) / max * 100)}%` }} /></span>
          <span className="num">{unit !== " M" ? `${fmt(r.v)}${unit}` : r.v && Math.abs(r.v) < 1 ? `${fmt(r.v * 1000)} QAR K` : `${fmt(r.v)} QAR M`}</span>
        </div>
      ))}
    </div>
  );
}

const k = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`);

/** Bars per calendar month; `series` holds one value array per year. Missing months are null. */
export function MonthBars({ series, labels, colors = ["var(--series)"] }: { series: (number | null)[][]; labels?: string[]; colors?: string[] }) {
  const W = 640, H = 200, pl = 48, pb = 24, pt = 10, iw = W - pl - 10, ih = H - pt - pb, bw = iw / 12;
  const mx = Math.max(1, ...series.flat().map((v) => v ?? 0));
  const step = Math.pow(10, Math.floor(Math.log10(mx))), top = Math.ceil(mx / step) * step;
  const y = (v: number) => pt + ih - Math.max(0, v) / top * ih;
  const n = series.length, w = (bw - 6) / n;
  return (
    <ChartTip><div className="tw">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420, direction: "ltr" }} role="img" aria-label="Monthly sales">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={pl} x2={W - 10} y1={y(top * i / 4)} y2={y(top * i / 4)} stroke="var(--line)" />
            <text x={pl - 6} y={y(top * i / 4) + 4} textAnchor="end">{k(top * i / 4)}</text>
          </g>
        ))}
        {MONTHS.map((m, i) => (
          <g key={m}>
            <text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle">{m}</text>
            {series.map((s, j) => s[i] == null ? null : (
              <rect key={j} x={pl + i * bw + 3 + j * w} y={y(s[i]!)} width={Math.max(2, w - 1)} height={Math.max(1, pt + ih - y(s[i]!))} rx="3" fill={colors[j % colors.length]} />
            ))}
            <rect className="chit" tabIndex={0} x={pl + i * bw} y={pt} width={bw} height={ih} data-tip={tip({
              t: m,
              r: series.map((s, j) => [labels?.[j] ?? "Sales", s[i] == null ? "—" : `${fmt(s[i]!)} QAR`, colors[j % colors.length]]),
            })} />
          </g>
        ))}
      </svg>
    </div></ChartTip>
  );
}

/** Brand rows; each brand expands to its products. */
export function BrandList({ brands }: { brands: { name: string; value: number; lastMonth: number; items?: { name: string; value: number; lastMonth: number; units?: number }[] }[] }) {
  const max = Math.max(1, ...brands.map((b) => b.value));
  const change = (value: number, lastMonth: number) => pct(value, lastMonth);
  const row = (name: string, value: number, lastMonth: number, units?: number) => (
    <>
      <span className="lab">{name}{units ? <small>Units: <span className="num">{fmt(units)}</span></small> : null}</span>
      <span className="track"><span className="fill" style={{ width: `${Math.max(1, Math.max(0, value) / max * 100)}%` }} /></span>
      <span className="num" style={{ textAlign: "end" }}>{fmt(value)}<small style={{ display: "block", fontSize: 11 }} className={change(value, lastMonth) >= 0 ? "up" : "down"}>{change(value, lastMonth) >= 0 ? "▲" : "▼"} {fmt(Math.abs(change(value, lastMonth)), 1)}%</small></span>
    </>
  );
  return (
    <div className="drill">
      {brands.map((b) => b.items?.length ? (
        <details key={b.name}>
          <summary className="dr">{row(b.name, b.value, b.lastMonth)}<span className="chev" aria-hidden="true">›</span></summary>
          <div className="items">{b.items.map((i) => <div className="dr" key={i.name}>{row(i.name, i.value, i.lastMonth, i.units)}<span className="chev" /></div>)}</div>
        </details>
      ) : <div className="dr" key={b.name}>{row(b.name, b.value, b.lastMonth)}<span className="chev" /></div>)}
    </div>
  );
}
