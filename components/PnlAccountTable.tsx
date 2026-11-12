"use client";
import { useState } from "react";
import { fmt, MONTHS, sum } from "@/lib/format";

type Row = { sub: string; m: number[] };
type Group = { main: string; kind: "revenue" | "cost"; rows: Row[] };
const SECTIONS = [["revenue", "Revenue", "Total revenue"], ["cost", "Costs", "Total costs"]] as const;

const cell = (v: number, key?: number) => <td key={key} className={`n num${v < 0 ? " down" : ""}`}>{v ? fmt(v) : "–"}</td>;

/** The "By account" grid of the monthly P&L: a total row per main account that expands to its sub accounts, plus an expand / collapse all button. Starts collapsed. */
export function PnlAccountTable({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = open.size === groups.length;
  const toggle = (main: string) => setOpen((s) => { const next = new Set(s); if (!next.delete(main)) next.add(main); return next; });
  return (
    <>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <button type="button" className="btn sm" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.main)))}>{allOpen ? "Collapse all" : "Expand all"}</button>
    </div>
    <div className="tw"><table className="pl">
      <thead>
        <tr>
          <th>Account</th>
          {MONTHS.map((m) => <th key={m} className="n">{m}</th>)}
          <th className="n">Total</th>
        </tr>
      </thead>
      {SECTIONS.map(([kind, title, totalLabel]) => {
        const list = groups.filter((g) => g.kind === kind);
        if (!list.length) return null;
        const monthly = Array.from({ length: 12 }, (_, i) => sum(list.flatMap((g) => g.rows.map((r) => r.m[i]))));
        return [
          <tbody key={kind + "-title"}><tr className="sec"><td colSpan={14}>{title}</td></tr></tbody>,
          ...list.map(({ main, rows }) => {
            const months = Array.from({ length: 12 }, (_, i) => sum(rows.map((r) => r.m[i])));
            const isOpen = open.has(main);
            return (
              <tbody key={main}>
                <tr className="grp">
                  <td>
                    <button type="button" className="pl-toggle" aria-expanded={isOpen} onClick={() => toggle(main)}>
                      <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span> {main} <small>({rows.length})</small>
                    </button>
                  </td>
                  {months.map((v, i) => cell(v, i))}
                  {cell(sum(months))}
                </tr>
                {isOpen && rows.map((r) => (
                  <tr key={r.sub}><td style={{ paddingLeft: 30 }}>{r.sub}</td>{r.m.map((v, i) => cell(v, i))}{cell(sum(r.m))}</tr>
                ))}
              </tbody>
            );
          }),
          <tbody key={kind + "-total"}><tr className="tot"><td>{totalLabel}</td>{monthly.map((v, i) => cell(v, i))}{cell(sum(monthly))}</tr></tbody>,
        ];
      })}
    </table></div>
    </>
  );
}
