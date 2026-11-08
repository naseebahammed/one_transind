import { fmt, MONTHS } from "@/lib/format";
import { ChartTip } from "@/components/ChartTip";
import { tip } from "@/lib/tip";

/** "▲ 4.2% vs <ref>" tooltip footer; empty when there is nothing to compare. */
const vs = (a: number | null | undefined, b: number | null | undefined, ref: string) =>
  a == null || !b ? {} : { f: `${a >= b ? "▲" : "▼"} ${fmt(Math.abs(((a - b) / Math.abs(b)) * 100), 1)}% vs ${ref}`, fc: a >= b ? ("up" as const) : ("down" as const) };

export function Spark({ id, data }: { id: string; data: number[] }) {
  if (!data.length) return null;
  const pts = data.length === 1 ? [data[0], data[0]] : data;
  const W = 120, H = 30, mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1) * W).toFixed(1)},${(H - 3 - (v - mn) / r * (H - 6)).toFixed(1)}`).join("");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--cyan)", stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: "var(--cyan)", stopOpacity: 0 }} /></linearGradient></defs>
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" style={{ stroke: "var(--cyan)" }} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Chart values arrive in millions; when every value is under 1M, show thousands instead. */
const autoUnit = (vals: (number | null)[]) => {
  const peak = Math.max(0, ...vals.map((v) => Math.abs(v ?? 0)));
  return peak > 0 && peak < 1 ? { f: 1000, u: "QAR K" } : { f: 1, u: "QAR M" };
};
const scale = (a: (number | null)[], f: number) => a.map((v) => (v == null ? null : v * f));

/** Group revenue by month: solid actual line, dashed target line. Values in QAR M. */
export function LineChart({ actual: rawA, target: rawT }: { actual: number[]; target: number[] }) {
  if (!rawA.length) return <p className="empty">—</p>;
  const { f, u: unit } = autoUnit([...rawA, ...rawT]), actual = scale(rawA, f) as number[], target = scale(rawT, f) as number[];
  const W = 640, H = 230, pl = 36, pr = 12, pt = 12, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
  const mx = Math.max(...actual, ...target, 1), step = Math.pow(10, Math.floor(Math.log10(mx))), top = Math.ceil(mx / step) * step;
  const x = (i: number) => pl + i * (iw / 11), y = (v: number) => pt + ih - (v / top) * ih;
  const path = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const ap = path(actual), last = actual.length - 1;
  return (
    <ChartTip>
      <div className="tw">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420, direction: "ltr" }} role="img" aria-label="Monthly revenue">
          {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(top * i / 4)} y2={y(top * i / 4)} stroke="var(--line)" /><text x={pl - 6} y={y(top * i / 4) + 4} textAnchor="end">{fmt(top * i / 4)}</text></g>)}
          {MONTHS.map((m, i) => <text key={m} x={x(i)} y={H - 6} textAnchor="middle" style={{ fontFamily: "var(--f-body)" }}>{m}</text>)}
          <defs>
            <linearGradient id="lca" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--cyan)", stopOpacity: 0.32 }} /><stop offset="1" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} /></linearGradient>
            <linearGradient id="lcl" x1="0" x2="1"><stop offset="0" style={{ stopColor: "#4a63ff" }} /><stop offset="1" style={{ stopColor: "#3ad6ff" }} /></linearGradient>
          </defs>
          <path d={`${ap}L${x(last)},${y(0)}L${x(0)},${y(0)}Z`} fill="url(#lca)" />
          {target.length > 0 && <path d={path(target)} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="5 4" />}
          <path d={ap} fill="none" stroke="url(#lcl)" strokeWidth="2.5" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(58,214,255,.5))" }} />
          <circle cx={x(last)} cy={y(actual[last])} r="4.5" fill="var(--series)" stroke="var(--panel)" strokeWidth="2" />
          <text x={x(last)} y={y(actual[last]) - 10} textAnchor="middle" style={{ fill: "var(--ink)" }}>{fmt(actual[last], 1)}</text>
          {MONTHS.map((m, i) => <rect key={m} className="chit" tabIndex={0} aria-label={`${m} revenue`} x={x(i) - iw / 22} y={pt} width={iw / 11} height={ih} data-tip={tip({
            t: m,
            r: [
              ["Actual", actual[i] == null ? "—" : `${fmt(actual[i], 1)} ${unit}`, "#3ad6ff"],
              ...(rawT.length > 0 ? [["Target", target[i] == null ? "—" : `${fmt(target[i], 1)} ${unit}`, "var(--series-2)", true] as [string, string, string, boolean]] : []),
            ],
            ...vs(actual[i], target[i], "target"),
          })} />)}
        </svg>
      </div>
      <div className="legend"><span><i></i>Actual</span>{rawT.length > 0 && <span><i className="t"></i>Target</span>}</div>
    </ChartTip>
  );
}

const YEAR_FILLS = ["rgba(140,160,255,.28)", "#4a63ff", "url(#cmpg)"];
const swatch = (i: number) => (i === 2 ? "linear-gradient(#3ad6ff,#4a63ff)" : YEAR_FILLS[i]);

/** Three-year grouped bars per month, with the selected month highlighted. Values in QAR M; negative bars hang below the zero line. */
export function CompareChart({ years: rawYears, series: raw, sel, href }: { years: number[]; series: (number | null)[][]; sel: number; href?: (m: number) => string }) {
  const years = rawYears.slice(-3), trimmed = raw.slice(-3);
  const { f, u } = autoUnit(trimmed.flat()), series = trimmed.map((a) => scale(a, f));
  const W = 720, H = 250, pl = 38, pr = 10, pt = 14, pb = 28, iw = W - pl - pr, ih = H - pt - pb, gw = iw / 12, bw = gw / 4.2;
  const vals = series.flat().map((v) => v ?? 0);
  const lo = Math.min(0, ...vals) * 1.12, hi = Math.max(lo ? 0 : 1, ...vals) * 1.12 || 1, span = hi - lo || 1;
  const yy = (v: number) => pt + ih - ((v - lo) / span) * ih, y0 = yy(0);
  // ~5 gridlines on a 1/2/5 step, whatever the magnitude (thousands need far bigger steps than millions).
  const p = 10 ** Math.floor(Math.log10(span / 5)), step = [1, 2, 5, 10].find((m) => m * p >= span / 5)! * p;
  const grid: number[] = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(Math.round(v * 1e6) / 1e6);
  const off = 3 - years.length;
  return (
    <ChartTip>
      <div className="tw">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, direction: "ltr" }} role="img" aria-label="Monthly comparison">
          <defs><linearGradient id="cmpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "#3ad6ff" }} /><stop offset="1" style={{ stopColor: "#4a63ff" }} /></linearGradient></defs>
          {grid.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={yy(v)} y2={yy(v)} stroke="var(--line)" /><text x={pl - 6} y={yy(v) + 4} textAnchor="end">{fmt(v, step < 1 ? 1 : 0)}</text></g>)}
          {MONTHS.map((mn, m) => {
            const x0 = pl + m * gw;
            return (
              <g key={mn}>
                {m === sel && <rect x={x0 + 1} y={pt - 4} width={gw - 2} height={ih + 4} rx="6" fill="rgba(58,214,255,.08)" stroke="rgba(58,214,255,.35)" />}
                {years.map((y, i) => { const v = series[i][m]; return v == null ? null : <rect key={y} x={x0 + gw * 0.1 + i * bw * 1.05} y={yy(Math.max(v, 0))} width={bw} height={Math.max(1, Math.abs(yy(v) - y0))} rx="3" fill={YEAR_FILLS[i + off]} />; })}
                {(() => {
                  const cell = <rect className="chit" tabIndex={href ? -1 : 0} x={x0} y={pt} width={gw} height={ih} data-tip={tip({
                    t: mn,
                    r: years.map((y, i) => [String(y), series[i][m] == null ? "—" : `${fmt(series[i][m]!, 2)} ${u}`, swatch(i + off)]),
                    ...(years.length > 1 ? vs(series[years.length - 1][m], series[years.length - 2][m], String(years[years.length - 2])) : {}),                  })} />;
                  return href ? <a href={href(m)} aria-label={`${mn} details`}>{cell}</a> : cell;
                })()}
                <text x={x0 + gw / 2} y={H - 8} textAnchor="middle" style={{ fontFamily: "var(--f-body)" }}>{mn}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="legend">{years.map((y, i) => <span key={y}><i style={{ background: swatch(i + off), height: 10, width: 10, borderRadius: 2 }} />{y}</span>)}<span className="src">{u}</span></div>
    </ChartTip>
  );
}
