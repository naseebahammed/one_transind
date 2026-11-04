"use client";
import { useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import type { Tip } from "@/lib/tip";

/** Wraps a server-rendered SVG chart; shows one styled card for any `[data-tip]` under the pointer or keyboard focus. */
export function ChartTip({ children }: { children: ReactNode }) {
  const [s, set] = useState<{ d: Tip; x: number; y: number } | null>(null);
  const at = (el: EventTarget, x?: number, y?: number) => {
    const hit = (el as Element).closest?.("[data-tip]");
    if (!hit) return set(null);
    if (x == null) { const b = hit.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + 8; }
    set({ d: JSON.parse(hit.getAttribute("data-tip")!), x, y: y! });
  };
  // Flip to the pointer's left past mid-screen so the card never runs off the edge.
  const left = s && s.x > window.innerWidth / 2;
  return (
    <div
      className="ctip-wrap"
      onPointerMove={(e: PointerEvent) => at(e.target, e.clientX, e.clientY)}
      onPointerLeave={() => set(null)}
      onFocus={(e: FocusEvent) => at(e.target)}
      onBlur={() => set(null)}
    >
      {children}
      {s && (
        <div className="ctip" role="tooltip" style={{ left: s.x, top: s.y, transform: `translate(${left ? "calc(-100% - 14px)" : "14px"}, -50%)` }}>
          <div className="ctip-t">{s.d.t}</div>
          {s.d.r.map(([l, v, c, dash]) => (
            <div className="ctip-r" key={l}>
              <i style={dash ? { borderTop: `2px dashed ${c}` } : { background: c }} />
              <span>{l}</span>
              <b>{v}</b>
            </div>
          ))}
          {s.d.f && <div className={`ctip-f ${s.d.fc ?? ""}`}>{s.d.f}</div>}
        </div>
      )}
    </div>
  );
}
