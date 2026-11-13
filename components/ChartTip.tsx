"use client";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Tip } from "@/lib/tip";

type TipState = {
  d: Tip;
  x: number;
  y: number;
  mode: "hover" | "pinned";
  href?: string;
};

function findHit(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest("[data-tip]") ?? target.querySelector("[data-tip]");
}

function parseTip(el: Element): Tip | null {
  const raw = el.getAttribute("data-tip");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tip;
  } catch {
    return null;
  }
}

function TipRows({ data }: { data: Tip }) {
  return (
    <>
      {data.r.map(([l, v, c, dash]) => (
        <div className="ctip-r" key={l}>
          <i style={dash ? { borderTop: `2px dashed ${c}` } : { background: c }} />
          <span>{l}</span>
          <b><bdi>{v}</bdi></b>
        </div>
      ))}
      {data.f && <div className={`ctip-f ${data.fc ?? ""}`}><bdi>{data.f}</bdi></div>}
    </>
  );
}

/**
 * Wraps a server-rendered SVG chart:
 * - Mouse/pen & keyboard focus: viewport-clamped floating tooltip card.
 * - Touch: tap a bar to pin an inline readout card (preventing accidental link jumps on first tap),
 *   tap outside or press Escape to dismiss.
 */
export function ChartTip({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TipState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pointerTypeRef = useRef<string>("mouse");
  const activeHitRef = useRef<Element | null>(null);

  const clearActiveAttr = () => {
    if (activeHitRef.current) {
      activeHitRef.current.removeAttribute("data-active");
      activeHitRef.current = null;
    }
  };

  const dismissPinned = () => {
    clearActiveAttr();
    setState(null);
  };

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || state?.mode !== "hover") return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;
    const gap = 14;
    const preferLeft = state.x + gap + rect.width > vw - pad && state.x - gap - rect.width >= pad;
    const rawLeft = preferLeft ? state.x - rect.width - gap : state.x + gap;
    const left = Math.max(pad, Math.min(rawLeft, vw - rect.width - pad));
    const rawTop = state.y - rect.height / 2;
    const top = Math.max(pad, Math.min(rawTop, vh - rect.height - pad));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [state]);

  useEffect(() => {
    if (state?.mode !== "pinned") return;
    const onPointerDownOutside = (ev: globalThis.PointerEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) {
        clearActiveAttr();
        setState(null);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        clearActiveAttr();
        setState(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDownOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [state?.mode]);

  useEffect(() => () => clearActiveAttr(), []);

  const onPointerDown = (e: PointerEvent) => {
    pointerTypeRef.current = e.pointerType;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || state?.mode === "pinned") return;
    const hit = findHit(e.target);
    if (!hit) {
      setState(null);
      return;
    }
    const d = parseTip(hit);
    if (d) setState({ d, x: e.clientX, y: e.clientY, mode: "hover" });
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    setState((prev) => (prev?.mode === "hover" ? null : prev));
  };

  const onFocus = (e: FocusEvent) => {
    if (pointerTypeRef.current === "touch") return;
    const hit = findHit(e.target);
    if (!hit) return;
    const d = parseTip(hit);
    if (!d) return;
    const b = hit.getBoundingClientRect();
    setState({ d, x: b.left + b.width / 2, y: b.top + Math.min(24, b.height / 2), mode: "hover" });
  };

  const onBlur = () => {
    setState((prev) => (prev?.mode === "hover" ? null : prev));
  };

  const onClick = (e: MouseEvent) => {
    if (pointerTypeRef.current !== "touch") return;
    if ((e.target as Element).closest?.(".ctip-pinned")) return;
    const hit = findHit(e.target);
    if (!hit) {
      dismissPinned();
      return;
    }
    const d = parseTip(hit);
    if (!d) return;
    const anchor = hit.closest("a[href]") as HTMLAnchorElement | null;
    if (state?.mode === "pinned" && activeHitRef.current === hit) {
      if (!anchor) dismissPinned();
      else clearActiveAttr();
      return;
    }
    if (anchor) e.preventDefault();
    clearActiveAttr();
    hit.setAttribute("data-active", "true");
    activeHitRef.current = hit;
    setState({
      d,
      x: 0,
      y: 0,
      mode: "pinned",
      href: anchor?.getAttribute("href") ?? undefined,
    });
  };

  const isArabic = state?.mode === "pinned" && typeof document !== "undefined" && document.documentElement.lang === "ar";

  return (
    <div
      ref={wrapRef}
      className="ctip-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
    >
      {children}
      {state?.mode === "hover" && (
        <div ref={tipRef} className="ctip" role="tooltip" style={{ left: state.x, top: state.y }}>
          <div className="ctip-t">{state.d.t}</div>
          <TipRows data={state.d} />
        </div>
      )}
      {state?.mode === "pinned" && (
        <div className="ctip-pinned" role="region" aria-live="polite">
          <div className="ctip-pinned-head">
            <span className="ctip-t">{state.d.t}</span>
            <span className="ctip-pinned-actions">
              {state.href && (
                <Link href={state.href} className="ctip-pinned-link" onClick={dismissPinned}>
                  {isArabic ? "عرض التفاصيل ←" : "View details →"}
                </Link>
              )}
              <button
                type="button"
                className="ctip-pinned-close"
                onClick={dismissPinned}
                aria-label={isArabic ? "إغلاق" : "Close"}
              >
                ×
              </button>
            </span>
          </div>
          <TipRows data={state.d} />
        </div>
      )}
    </div>
  );
}
