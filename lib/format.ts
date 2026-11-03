export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmt = (n: number, d = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
export const money = (n: number) => (Math.abs(n) >= 1e6 ? fmt(n / 1e6, 2) + " M" : fmt(n));
export const pct = (a: number, b: number) => (b ? (a / b - 1) * 100 : 0);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
