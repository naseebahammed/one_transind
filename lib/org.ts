// Structure of the legacy HR directory. No HR source is connected, so every headcount is 0.
export const SECTORS = [
  ["fmcg", "FMCG & Distribution"], ["fnb", "Food & Beverage"], ["re", "Real Estate"], ["retail", "Hypermarkets & Retail"],
  ["log", "Logistics"], ["con", "Construction & Interiors"], ["hb", "Health & Beauty"], ["fm", "Facility Management"],
] as const;
// Sector keys the code relies on by name (pages, upload rules). Use these instead of the bare strings.
export const SECTOR = { fmcg: "fmcg", realEstate: "re", retail: "retail", healthBeauty: "hb" } as const;
export const DEPTS = ["Sales", "Operations", "Maintenance", "Admin & support"];
export const JOBS: Record<string, string[][]> = {
  fmcg: [["Van salesman", "Merchandiser", "Sales supervisor", "Key account manager"], ["Delivery driver", "Storekeeper", "Delivery helper", "Forklift operator"], ["Fleet mechanic", "Refrigeration technician", "Electrician"], ["Accountant", "Customer service", "Data entry clerk", "HR officer", "Manager"]],
  fnb: [["Catering coordinator", "Corporate sales executive"], ["Crew / barista", "Cook", "Cashier", "Branch manager"], ["Kitchen equipment technician", "AC technician"], ["Accountant", "Area manager", "HR officer"]],
  re: [["Leasing agent"], ["Property manager"], ["Plumber", "Electrician", "AC technician", "Handyman"], ["Accountant", "Receptionist"]],
  retail: [["Store supervisor"], ["Cashier", "Shelf stocker", "Fresh counter staff"], ["Maintenance technician"], ["Accountant", "Store manager"]],
  log: [["Business development"], ["Driver", "Warehouse operator", "Customs clearance agent"], ["Mechanic", "Reefer technician"], ["Operations coordinator"]],
  con: [["Estimator"], ["Painter", "Carpenter", "Site engineer", "Foreman"], ["MEP technician"], ["Project administrator"]],
  hb: [["Medical rep", "Beauty advisor"], ["Hair stylist", "Therapist"], ["Technician"], ["Accountant", "Receptionist"]],
  fm: [["Account manager"], ["Cleaner", "Cleaning supervisor"], ["Landscaping gardener", "Maintenance technician", "Plumber", "Electrician", "AC technician"], ["Coordinator"]],
};
