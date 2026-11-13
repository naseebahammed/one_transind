// Pure page-module rules, kept apart from access.ts (which needs node:crypto) so client components can import them.
// A module is a top-level page area (first path segment). A listed user's modules: null = every module, otherwise only those listed. Admins always get everything.
export const MODULES = [
  { area: "dashboard", label: "Group dashboard" },
  { area: "sales", label: "Sales" },
  { area: "trading", label: "Trading sales (actual)" },
  { area: "restaurants", label: "Restaurants" },
  { area: "customers", label: "Customers" },
  { area: "hr", label: "Human resources" },
  { area: "real-estate", label: "Real Estate" },
  { area: "health-beauty", label: "Health & Beauty" },
  { area: "retail", label: "Hypermarkets & Retail" },
  { area: "logistics", label: "Logistics" },
  { area: "sectors", label: "Other sectors (added in Admin)" },
  { area: "finance", label: "Finance" },
] as const;

export type UserModules = readonly string[] | null;

export const canOpen = (modules: UserModules, area: string) => modules === null || modules.includes(area);

/** Keeps only known, distinct modules from submitted form values. */
export const cleanModules = (values: unknown[]) => MODULES.map((m) => m.area).filter((area) => values.includes(area));

/** Where to send someone who has no particular page in mind: the first module they may open that has a page of its own. */
export const landingPage = (modules: UserModules) => {
  const first = MODULES.find((m) => m.area !== "sectors" && canOpen(modules, m.area));
  return first ? `/${first.area}` : null;
};
