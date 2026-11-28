"use client";
import { useEffect, useState } from "react";

export const UI_VERSION_KEY = "ui-version";

// V1 = current look, V2 = proposed "Bold & Visual" theme. The choice is kept per browser (localStorage) and applied as <html data-ui>.
export function ThemeVersion() {
  const [version, setVersion] = useState("v1");
  useEffect(() => {
    try { setVersion(localStorage.getItem(UI_VERSION_KEY) === "v2" ? "v2" : "v1"); } catch { }
  }, []);
  const pick = (next: string) => {
    setVersion(next);
    document.documentElement.dataset.ui = next;
    try { localStorage.setItem(UI_VERSION_KEY, next); } catch { }
  };
  return (
    <div className="ver" role="group" aria-label="Design version">
      <span aria-hidden="true">Design</span>
      <button type="button" aria-pressed={version === "v1"} onClick={() => pick("v1")} title="V1 (current)">V1 <small>current</small></button>
      <button type="button" aria-pressed={version === "v2"} onClick={() => pick("v2")} title="V2 (proposed)">V2 <small>proposed</small></button>
    </div>
  );
}
