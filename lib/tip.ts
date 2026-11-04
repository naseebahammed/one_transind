/** Chart tooltip payload, JSON-encoded into a hit area's `data-tip` (read by components/ChartTip). Rows: [label, value, swatch CSS background, dashed?]. */
export type Tip = { t: string; r: [string, string, string, boolean?][]; f?: string; fc?: "up" | "down" };
export const tip = (d: Tip) => JSON.stringify(d);
