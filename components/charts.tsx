import { fmt, MONTHS } from "@/lib/format";

export function Spark({ id, data }: { id: string; data: number[] }) {
  const W = 120, H = 30, mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const d = data.map((v, i) => `${i ? "L" : "M"}${(i / Math.max(1, data.length - 1) * W).toFixed(1)},${(H - 3 - (v - mn) / r * (H - 6)).toFixed(1)}`).join("");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--cyan)", stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: "var(--cyan)", stopOpacity: 0 }} /></linearGradient></defs>
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" style={{ stroke: "var(--cyan)" }} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Group revenue by month: solid actual line, dashed target line. */
export function LineChart({ actual, target, unit = "M" }: { actual: number[]; target: number[]; unit?: string }) {
  const W = 640, H = 230, pl = 36, pr = 12, pt = 12, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
  const mx = Math.max(...actual, ...target, 1), step = Math.pow(10, Math.floor(Math.log10(mx))), top = Math.ceil(mx / step) * step;
  const x = (i: number) => pl + i * (iw / 11), y = (v: number) => pt + ih - (v / top) * ih;
  const path = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const ap = path(actual), last = actual.length - 1;
  return (
    <>
      <div className="tw">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420, direction: "ltr" }} role="img" aria-label="Monthly revenue">
          {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(top * i / 4)} y2={y(top * i / 4)} stroke="var(--line)" /><text x={pl - 6} y={y(top * i / 4) + 4} textAnchor="end">{fmt(top * i / 4)}</text></g>)}
          {MONTHS.map((m, i) => <text key={m} x={x(i)} y={H - 6} textAnchor="middle" style={{ fontFamily: "var(--f-body)" }}>{m}</text>)}
          <defs>
            <linearGradient id="lca" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--cyan)", stopOpacity: 0.32 }} /><stop offset="1" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} /></linearGradient>
            <linearGradient id="lcl" x1="0" x2="1"><stop offset="0" style={{ stopColor: "#4a63ff" }} /><stop offset="1" style={{ stopColor: "#3ad6ff" }} /></linearGradient>
          </defs>
          <path d={`${ap}L${x(last)},${y(0)}L${x(0)},${y(0)}Z`} fill="url(#lca)" />
          <path d={path(target)} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="5 4" />
          <path d={ap} fill="none" stroke="url(#lcl)" strokeWidth="2.5" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(58,214,255,.5))" }} />
          <circle cx={x(last)} cy={y(actual[last])} r="4.5" fill="var(--series)" stroke="var(--panel)" strokeWidth="2" />
          <text x={x(last)} y={y(actual[last]) - 10} textAnchor="middle" style={{ fill: "var(--ink)" }}>{fmt(actual[last], 1)}</text>
          {MONTHS.map((m, i) => <rect key={m} x={x(i) - iw / 22} y={pt} width={iw / 11} height={ih} fill="transparent"><title>{`${m} · Actual: ${actual[i] == null ? "—" : fmt(actual[i], 1)} ${unit} · Target: ${fmt(target[i] ?? 0, 1)}`}</title></rect>)}
        </svg>
      </div>
      <div className="legend"><span><i></i>Actual</span><span><i className="t"></i>Target</span></div>
    </>
  );
}

const YEAR_FILLS = ["rgba(140,160,255,.28)", "#4a63ff", "url(#cmpg)"];

/** Three-year grouped bars per month, with the selected month highlighted. Values in QAR M. */
export function CompareChart({ years, series, sel, href }: { years: number[]; series: (number | null)[][]; sel: number; href?: (m: number) => string }) {
  const W = 720, H = 250, pl = 38, pr = 10, pt = 14, pb = 28, iw = W - pl - pr, ih = H - pt - pb, gw = iw / 12, bw = gw / 4.2;
  const mx = Math.max(1, ...series.flat().map((v) => v ?? 0)) * 1.12, yy = (v: number) => pt + ih - v / mx * ih;
  const step = mx > 60 ? 20 : mx > 25 ? 10 : mx > 12 ? 5 : mx > 5 ? 2 : mx > 2 ? 1 : 0.5;
  const grid: number[] = []; for (let v = 0; v <= mx; v += step) grid.push(v);
  const off = 3 - years.length;
  return (
    <>
      <div className="tw">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, direction: "ltr" }} role="img" aria-label="Monthly comparison">
          <defs><linearGradient id="cmpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "#3ad6ff" }} /><stop offset="1" style={{ stopColor: "#4a63ff" }} /></linearGradient></defs>
          {grid.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={yy(v)} y2={yy(v)} stroke="var(--line)" /><text x={pl - 6} y={yy(v) + 4} textAnchor="end">{fmt(v, step < 1 ? 1 : 0)}</text></g>)}
          {MONTHS.map((mn, m) => {
            const x0 = pl + m * gw;
            return (
              <g key={mn}>
                {m === sel && <rect x={x0 + 1} y={pt - 4} width={gw - 2} height={ih + 4} rx="6" fill="rgba(58,214,255,.08)" stroke="rgba(58,214,255,.35)" />}
                {years.map((y, i) => { const v = series[i][m]; return v == null ? null : <rect key={y} x={x0 + gw * 0.1 + i * bw * 1.05} y={yy(v)} width={bw} height={Math.max(1, ih - (yy(v) - pt))} rx="3" fill={YEAR_FILLS[i + off]} />; })}
                {(() => {
                  const cell = <rect x={x0} y={pt} width={gw} height={ih} fill="transparent" style={{ cursor: href ? "pointer" : "default" }}><title>{`${mn} · ${years.map((y, i) => `${y}: ${series[i][m] == null ? "—" : fmt(series[i][m]!, 1)}`).join(" · ")}`}</title></rect>;
                  return href ? <a href={href(m)}>{cell}</a> : cell;
                })()}
                <text x={x0 + gw / 2} y={H - 8} textAnchor="middle" style={{ fontFamily: "var(--f-body)" }}>{mn}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="legend">{years.map((y, i) => <span key={y}><i style={{ background: i + off === 2 ? "linear-gradient(#3ad6ff,#4a63ff)" : YEAR_FILLS[i + off], height: 10, width: 10, borderRadius: 2 }} />{y}</span>)}<span className="src">QAR M</span></div>
    </>
  );
}

export function HourBars({ values }: { values: number[] }) {
  const W = 640, H = 220, pl = 36, pt = 10, pb = 24, iw = W - pl - 10, ih = H - pt - pb, bw = iw / values.length;
  const top = Math.max(30, ...values), y = (v: number) => pt + ih - v / top * ih;
  return (
    <div className="tw">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420, direction: "ltr" }} role="img" aria-label="Sales by hour">
        {[0, 10, 20, 30].map((v) => <g key={v}><line x1={pl} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={pl - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
        {values.map((v, i) => <g key={i}><rect x={pl + i * bw + 2} y={y(v)} width={bw - 4} height={Math.max(0, ih - (y(v) - pt))} rx="3" fill="var(--series)"><title>{`${i + 7}:00 · ${v}k QAR`}</title></rect><text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle">{i + 7}</text></g>)}
      </svg>
    </div>
  );
}
