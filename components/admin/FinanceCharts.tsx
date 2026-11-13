import { ChartTip } from "@/components/ChartTip";
import { tip } from "@/lib/tip";
import { fmt } from "@/lib/format";

const W = 720, H = 260, PL = 52, PR = 10, PT = 12, PB = 26;
const k = (v: number) => `${Math.round(v / 1000)}k`;

type Series = { name: string; color: string; data: number[] };

/** Grouped monthly bars on a shared zero baseline; negatives hang below it. */
export function MonthBars({ months, series, label }: { months: string[]; series: Series[]; label: string }) {
  const all = series.flatMap((s) => s.data);
  const step = 10 ** Math.floor(Math.log10(Math.max(0, ...all.map(Math.abs)) || 1));
  const hi = Math.ceil(Math.max(...all, 0) / step) * step, lo = Math.floor(Math.min(...all, 0) / step) * step, span = hi - lo || 1;
  const y = (v: number) => PT + (H - PT - PB) * (1 - (v - lo) / span);
  const gw = (W - PL - PR) / months.length, bw = gw / (series.length + 1);
  const ticks: number[] = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
  return (
    <ChartTip>
      <div className="tw">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 440, direction: "ltr" }} role="img" aria-label={label}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--line-strong, var(--border))" : "var(--line, var(--border))"} />
              <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted-foreground, var(--muted))">{k(v)}</text>
            </g>
          ))}
          {months.map((m, i) => (
            <g key={m}>
              {series.map((s, j) => {
                const v = s.data[i], top = y(Math.max(v, 0)), h = Math.max(1, Math.abs(y(v) - y(0)));
                return <rect key={s.name} x={PL + i * gw + bw / 2 + j * bw} y={top} width={Math.max(2, bw - 2)} height={h} rx="3" fill={s.color} />;
              })}
              <rect className="chit" tabIndex={0} aria-label={`${m} figures`} x={PL + i * gw} y={PT} width={gw} height={H - PT - PB} data-tip={tip({
                t: m,
                r: series.map((s) => [s.name, `${s.data[i] < 0 ? "−" : ""}${fmt(Math.abs(s.data[i]), 2, 0)} QAR`, s.color]),
              })} />
              <text x={PL + i * gw + gw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted-foreground, var(--muted))" style={{ fontFamily: "var(--f-body, inherit)" }}>{m}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color, width: 10, height: 10, borderRadius: 2 }} />
            {s.name}
          </span>
        ))}
      </div>
    </ChartTip>
  );
}

/** Horizontal bars sized against the largest row. */
export function HBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map(([, v]) => v), 1), total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="space-y-2">
      {rows.map(([name, v]) => (
        <div key={name} className="grid grid-cols-[7rem_1fr_auto] sm:grid-cols-[9rem_1fr_9rem] items-center gap-3 text-sm">
          <span className="truncate">{name}</span>
          <div className="h-3 rounded-sm bg-muted"><div className="h-3 rounded-sm bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="text-right tabular-nums text-muted-foreground">{fmt(v, 2, 0)} · {total ? ((v / total) * 100).toFixed(1) : "0.0"}%</span>
        </div>
      ))}
    </div>
  );
}
