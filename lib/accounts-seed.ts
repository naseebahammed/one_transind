// Main account -> sub ledger accounts, loaded once when the accounts table is empty. Total/subtotal rows of the source sheet are not accounts.
export const ACCOUNT_SEED: Record<string, string[]> = {
  "REVENUE": ["Room Rent", "Extra Bed", "Food Income", "Laundry Income", "Mis Income", "Transport Income", "Business Centre Income", "Round off", "Bevarge Income"],
  "COGS": ["Consumable Expenses", "BOOKING.COM COMMISSION", "Co Beverage", "Credit card chargeback Expense", "Laundry expenses", "Sales Discount Expenses", "Guest Supply", "Cleaning Supply", "COS - Food", "Over Booking Expenses", "COS- Engineering", "Cutlery & Crockery", "COS - General", "Linen Demage Expenses"],
  "STAFF COST": ["Staff Salary", "Staff Food allowance", "Gratuity", "Staff Accommodation Rent", "Staff Accommodation Expenses", "Electricity & Water - Accommodation", "Annual Leave Tickets Exp", "Staff Insurance Exp", "Educational Allowance to staff kids", "Staff Uniforms Expenses", "Leave Salary", "Immigration & Visa Expense", "Visa Expense", "Transportation Allowance", "Complementary Expenses Staff", "Medical Expense - Staff", "Staff Laundry Expense", "Outsource Staff Salary", "Staff Welfare Expense", "Staff Bonus Expense", "Staff Medical card renewal", "Staff Medical Insurance", "Air Ticket", "Overtime", "Casual Staff Salary"],
  "UTILITY EXPENSES": ["Electricity & Water Expenses", "Tele Phone & Internet Expense"],
  "REPAIR AND MAINTENANCE EXP": ["Repair & Main Electrical", "Repair & Main Plumping", "Repair & Maint Computer and spare", "License & Govt Fee", "Repair & Main Building", "General Repair & Maintenance", "Air Conditioning & Maintenance", "Amc Fire Fighting & Alram", "Amc Elevators & Escalators", "Gardening Expenses"],
  "LEGAL AND PROFESSIONAL EXP": ["Government Exp", "Audit Exp", "Legal Exp", "Tender Fees"],
  "VEHICLE EXPENSES": ["Fuel", "Vehicle Repairs & Main - Exp:", "Vehicle Insurance", "Vehicle Fine & Other exp"],
  "MARKETING & ADVERTISING": ["Business Promotion Expense", "Sales and Marketing Expense", "Business Trip Expenses", "Advertising Expense"],
  "INSURANCE EXP": ["Fire Insurance Expense", "Money Insurance", "Fidelity Insurance", "Publice Laibilty insurance"],
  "COMPUTER & STATIONERY": ["Printing & Stationary Expense", "IT Software & Hardware Expenses"],
  "CLEANING EXP": ["Cleaning Expenses", "Garbage Removal", "Air Freshener Services", "Pest Control Exp", "Sewage & General Waste Removal", "Hygiene Machines Expenses"],
  "MISCELLANEOUS": ["Local Transport charges", "Decoration & Interior Exp", "Car Parking Expense", "Complementary Expenses", "Office Supplies", "Miscellaneous Expense", "water Coupen"],
  "DEPRECIATION PPE": ["DEPRECIATION EXPENSES - DECORATION", "DEPRECIATION EXPENSES - ELECTRICAL EQUIPMENT", "DEPRECIATION EXPENSES - FUR & FIX", "DEPRECIATION EXPENSES - INTANGIBLE ASSET", "DEPRECIATION EXPENSES - COMPUTERS & SERVERS", "DEPRECIATION EXPENSES-KITCHEN EQUIPMENTS", "DEPRECIATION EXPENSES - MOTOR VEHICLES", "Writte Off Account"],
  "FINANCE COST": ["Bank Charges", "Bank Interest -Doha Bank", "Credit cards Commissions", "Cash Round Off"],
  "PRE- OPERATING EXPESNES A/C": ["PRE- OPERATING EXPESNES A/C"],
};
