import { cleanText } from "./input-validation.ts";

const MAX_DRILL_SEGMENTS = 6;

export const parsePath = (s?: string) =>
  s
    ? s
        .split("|")
        .map((segment) => cleanText(segment, 120))
        .filter(Boolean)
        .slice(0, MAX_DRILL_SEGMENTS)
    : [];

/** Builds "/base?a=1&b=2", skipping empty values. */
export function link(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
