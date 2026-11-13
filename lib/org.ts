// Structure of the legacy HR directory. No HR source is connected, so every headcount is 0.
export const SECTORS = [
  ["fnb", "Food & Beverage"], ["re", "Real Estate"], ["retail", "Hypermarkets & Retail"],
  ["log", "Logistics"], ["hb", "Health & Beauty"], ["fm", "Facility Management"],
] as const;
// Sector keys the code relies on by name (pages, upload rules). Use these instead of the bare strings.
export const SECTOR = { foodBeverage: "fnb", realEstate: "re", retail: "retail", logistics: "log", healthBeauty: "hb", facilityManagement: "fm", trading: "transind-trading" } as const;
export const DEPTS = ["Sales", "Operations", "Maintenance", "Admin & support"];
export const JOBS: Record<string, string[][]> = {
  fnb: [["Catering coordinator", "Corporate sales executive"], ["Crew / barista", "Cook", "Cashier", "Branch manager"], ["Kitchen equipment technician", "AC technician"], ["Accountant", "Area manager", "HR officer"]],
  re: [["Leasing agent"], ["Property manager"], ["Plumber", "Electrician", "AC technician", "Handyman"], ["Accountant", "Receptionist"]],
  retail: [["Store supervisor"], ["Cashier", "Shelf stocker", "Fresh counter staff"], ["Maintenance technician"], ["Accountant", "Store manager"]],
  log: [["Business development"], ["Driver", "Warehouse operator", "Customs clearance agent"], ["Mechanic", "Reefer technician"], ["Operations coordinator"]],
  hb: [["Medical rep", "Beauty advisor"], ["Hair stylist", "Therapist"], ["Technician"], ["Accountant", "Receptionist"]],
  fm: [["Account manager"], ["Cleaner", "Cleaning supervisor"], ["Landscaping gardener", "Maintenance technician", "Plumber", "Electrician", "AC technician"], ["Coordinator"]],
};
