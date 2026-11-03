import Link from "next/link";
import type { ReactNode } from "react";
import type { DrillRow } from "@/lib/data";
import { fmt } from "@/lib/format";
import { Delta, MarginChip } from "@/components/ui";

type Props = {
  title: ReactNode;
  src?: string;
  mode: "mom" | "yoy" | "margin";
  rows: DrillRow[];
  labels: string[];        // label of each path node, for the breadcrumb
  path: string[];
  levels: string[];        // name of each level, shown top right
  rootLabel: string;
  href: (path: string[], all?: boolean) => string;
  all?: boolean;
  q?: string;
  yoyLabels?: [string, string]; // e.g. ["Oct 2025", "Oct 2024"]
  momLabel?: string;
  span?: number;
};

/** Click-through drill panel: rows link to the next level, breadcrumbs link back. State lives in the URL. */
export function Drill({ title, src, mode, rows, labels, path, levels, rootLabel, href, all, q, yoyLabels, momLabel, span = 12 }: Props) {
  const shown = q ? rows.filter((r) => (r.label + " " + r.sub).toLowerCase().includes(q.toLowerCase())) : rows;
  const leaf = path.length === levels.length - 1;
  const tot = shown.reduce((a, r) => a + r.v, 0), cost = shown.reduce((a, r) => a + r.c, 0);
  const lm = shown.reduce((a, r) => a + r.lv, 0), ly = shown.reduce((a, r) => a + r.ly, 0), ly2 = shown.reduce((a, r) => a + r.ly2, 0);
  const mx = Math.max(1, ...shown.map((r) => Math.abs(r.v)));
  const list = all ? shown : shown.slice(0, 25);
  const base = mode === "mom" ? "lv" : "ly";
  return (
    <section className={`panel c${span}`}>
      <header><h2>{title}</h2>{src != null && <span className="src">{src}</span>}</header>
      <div className="mtd">
        <span className="big">{fmt(tot)} QAR</span>
        {mode === "mom" && <span className={`d ${tot >= lm ? "up" : "down"}`} style={{ fontSize: 12.5 }}><Delta a={tot} b={lm} /> {momLabel ?? "vs last month"}</span>}
        {mode === "yoy" && yoyLabels && <>
          <span><Delta a={tot} b={ly} /> <span className="src">vs {yoyLabels[0]}</span></span>
          <span><Delta a={tot} b={ly2} /> <span className="src">vs {yoyLabels[1]}</span></span>
        </>}
        {mode === "margin" && <>
          <span className="src">Cost: <span className="num">{fmt(cost)}</span></span>
          <span><MarginChip s={tot} c={cost} /> <span className="src">Gross margin</span></span>
        </>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <nav className="crumbs" aria-label="breadcrumb">
          {path.length ? <Link href={href([])}>{rootLabel}</Link> : <span className="cur">{rootLabel}</span>}
          {path.map((_, i) => (
            <span key={i} style={{ display: "contents" }}><i>›</i>{i < path.length - 1 ? <Link href={href(path.slice(0, i + 1))}>{labels[i]}</Link> : <span className="cur">{labels[i]}</span>}</span>
          ))}
        </nav>
        <span className="src">{levels[path.length]} · {fmt(shown.length)}{leaf ? "" : " · click any row to drill down"}</span>
      </div>
      <div className="drill">
        {list.map((r) => {
          const inner = (
            <>
              <span className="lab">{r.label}{r.sub && <small>{r.sub}</small>}</span>
              <span className="track"><span className={`fill ${mode === "margin" && r.v < 0 ? "bad" : ""}`} style={{ width: `${Math.max(1, Math.abs(r.v) / mx * 100)}%` }} /></span>
              <span className="num" style={{ textAlign: "end" }}>{fmt(r.v)}<small style={{ display: "block", fontSize: 11 }}>
                {mode === "margin" ? <MarginChip s={r.v} c={r.c} /> : <Delta a={r.v} b={r[base]} small />}
              </small></span>
              <span className="chev" aria-hidden="true">{leaf ? "" : "›"}</span>
            </>
          );
          const tip = `${r.label}: ${fmt(r.v)} QAR · share ${fmt(tot ? r.v / tot * 100 : 0, 1)}%`;
          return leaf
            ? <div className="dr" key={r.k} title={tip} aria-disabled="true">{inner}</div>
            : <Link className="dr" key={r.k} title={tip} href={href([...path, r.k])}>{inner}</Link>;
        })}
        {!list.length && <p className="empty">—</p>}
      </div>
      {shown.length > list.length && <Link className="btn sm" href={href(path, true)} style={{ marginTop: 10, display: "inline-block" }}>Show all ({fmt(shown.length)})</Link>}
    </section>
  );
}
