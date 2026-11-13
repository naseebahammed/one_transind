// Pure access-level rules, kept apart from access.ts (which needs node:crypto) so client components can import them.
/** What a listed (non-admin) user may open. "full" = every page, which is what everyone had before access levels existed. */
export type Access = "full" | "finance" | "operations";
export const ACCESS_LEVELS: readonly Access[] = ["full", "finance", "operations"];

// Top-level page areas (first path segment) each level may open; null = all of them. Admins always get everything.
const ACCESS_AREAS: Record<Access, readonly string[] | null> = {
  full: null,
  finance: ["dashboard", "finance", "sales", "customers"],
  operations: ["dashboard", "sales", "trading", "restaurants", "real-estate", "health-beauty", "retail", "logistics", "sectors"],
};

export const areasFor = (access: Access) => ACCESS_AREAS[access];
export const canOpen = (access: Access, area: string) => ACCESS_AREAS[access]?.includes(area) ?? true;
export const isAccess = (value: unknown): value is Access => ACCESS_LEVELS.includes(value as Access);
