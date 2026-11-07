export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Pure (no imports) so `node --test` can load files that re-export from it. `min` < `d` drops trailing zeros (12.5, not 12.50).
export const fmt = (n: number, d = 0, min = d) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: min }).format(n);
export const money = (n: number) => (Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + " M" : fmt(n));
export const pct = (a: number, b: number) => (b ? (a / b - 1) * 100 : 0);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
