"use client";
import { useEffect } from "react";

// The dashboard logic is the original framework-free script, kept as-is in /public.
// React renders only the empty shell; app.js fills #nav and #content itself.
function load(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

// Module-level so StrictMode remounts and re-navigations never execute the scripts twice (they declare top-level consts).
let booted: Promise<unknown> | undefined;

export default function Dashboard() {
  useEffect(() => {
    // app.js reads window.__BOOT synchronously; fall back to its built-in mock data if the API is down.
    booted ??= Promise.all([
      load("/td.js"),
      fetch("/api/bootstrap").then((r) => r.json()).then((b) => ((window as unknown as { __BOOT: unknown }).__BOOT = b)).catch(() => { }),
      // real FMCG sales from Postgres; app.js keeps its sample data if this fails
      fetch("/api/sales").then((r) => (r.ok ? r.json() : Promise.reject())).then((b) => ((window as unknown as { __SALES: unknown }).__SALES = b)).catch(() => { }),
      fetch("/api/customers").then((r) => (r.ok ? r.json() : Promise.reject())).then((b) => ((window as unknown as { __CUST: unknown }).__CUST = b)).catch(() => { }),
    ])
      .then(() => load("/app.js"))
      .catch(console.error);
  }, []);

  return (
    <>
      <div className="app" id="app">
        <aside className="rail">
          <div className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Transind Holding" />
            <b id="brandName">One Transind</b>
          </div>
          <nav className="nav" id="nav" suppressHydrationWarning />
        </aside>
        <div className="main">
          <div className="top">
            <h1 id="viewTitle" suppressHydrationWarning />
            <span className="live">
              <i />
              <span id="liveTxt" suppressHydrationWarning />
            </span>
            <label className="ctl">
              <span id="lblSector" suppressHydrationWarning />
              <select id="sectorSel" suppressHydrationWarning />
            </label>
            <label className="ctl">
              <span id="lblRole" suppressHydrationWarning />
              <select id="roleSel" suppressHydrationWarning />
            </label>
            <button className="btn" id="langBtn" type="button">
              English
            </button>
          </div>
          <main className="content" id="content" suppressHydrationWarning />
        </div>
      </div>
      <div className="tip" id="tip" hidden />
      <div className="toast" id="toast" hidden />
    </>
  );
}

