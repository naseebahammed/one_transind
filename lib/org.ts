export const SECTORS = [
  ["fnb", "Food & Beverage"], ["re", "Real Estate"], ["retail", "Hypermarkets & Retail"],
  ["log", "Logistics"], ["hb", "Health & Beauty"], ["fm", "Facility Management"],
] as const;
// Sector keys the code relies on by name (pages, upload rules). Use these instead of the bare strings.
export const SECTOR = { foodBeverage: "fnb", realEstate: "re", retail: "retail", logistics: "log", healthBeauty: "hb", facilityManagement: "fm", trading: "transind-trading" } as const;
