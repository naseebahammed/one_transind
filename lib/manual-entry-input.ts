// Pure validation and parsing helpers for Admin -> Manual data entry (no database or Next imports so `node --test` and client forms can share it).
import { checkFigureCell, LINES, MONTHS, type GridSection } from "./company-data.ts";
import { cleanMultilineText, cleanText, isValidFigureAmount, parseNonNegativeInt, parsePositiveIntId } from "./input-validation.ts";
import { parseMoneyString, roundMoney } from "./money.ts";

export const MANUAL_TABS = [
  ["pnl", "P&L statement"],
  ["monthly", "Monthly figures"],
  ["real-estate", "Real estate"],
  ["restaurants-retail", "Restaurants & retail"],
  ["sales-fmcg", "Sales & FMCG"],
  ["finance-customers", "Finance & customers"],
  ["hr", "HR & staff"],
  ["logistics", "Logistics"],
] as const;

export type ManualTab = (typeof MANUAL_TABS)[number][0];

export const isManualTab = (value: string): value is ManualTab => MANUAL_TABS.some(([key]) => key === value);

export const STANDARD_RECEIPT_CHANNELS = [
  "Cash sales",
  "Credit card sales",
  "Credit sales",
  "Talabat cash",
  "Talabat credit card",
  "Talabat discount",
  "Snoonu cash",
  "Snoonu",
  "Deliveroo",
  "Keeta",
  "Rafeeq",
  "Bank deposits",
] as const;

export const COGS_MANUAL_LINES = [
  ["Gross sales", 1],
  ["Discount", -1],
  ["Net sales", 1],
  ["CPU transfer", -1],
  ["Stock GL balance", 1],
  ["Closing inventory", 1],
  ["COGS", -1],
] as const;

export const UNIT_METRIC_LINES = ["Available", "Long stay", "Short stay", "Room revenue"] as const;

export const SALES_INDICATORS = [
  ["van_sales", "Van sales", "QAR"],
  ["key_accounts", "Key accounts", "QAR"],
  ["horeca", "HORECA", "QAR"],
  ["wholesale", "Wholesale", "QAR"],
  ["out_of_stock_loss", "Out-of-stock loss", "QAR"],
  ["price_realisation", "Price realisation", "%"],
  ["promo_uplift", "Promo uplift", "%"],
] as const;

export type SalesIndicatorKey = (typeof SALES_INDICATORS)[number][0];

type ParseResult<T> = { error: string } | { data: T };

export function parseIsoDate(raw: unknown): string | null {
  const text = cleanText(raw, 20);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1950 || year > 2100) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== text) return null;
  return text;
}

export function parseYearMonth(rawYear: unknown, rawMonth: unknown): { year: number; month: number; period: string } | null {
  const year = Number(cleanText(rawYear, 10));
  const monthText = cleanText(rawMonth, 10);
  if (!monthText || !/^\d{1,2}$/.test(monthText)) return null;
  const month = Number(monthText);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 0 || month > 11) return null;
  return { year, month, period: `${year}-${String(month + 1).padStart(2, "0")}-01` };
}

export function parseOptionalAmount(raw: unknown, allowNegative = false): number | undefined | "bad" {
  if (raw === null || raw === undefined) return undefined;
  const text = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!text) return undefined;
  const parsed = parseMoneyString(text);
  if (parsed === null || !isValidFigureAmount(parsed)) return "bad";
  if (!allowNegative && parsed < 0) return "bad";
  return roundMoney(parsed);
}

export function parseRequiredAmount(raw: unknown, allowNegative = false): number | null {
  const parsed = parseOptionalAmount(raw, allowNegative);
  return parsed === undefined || parsed === "bad" ? null : parsed;
}

const optionalCompanyId = (raw: unknown): number | null | "bad" => {
  const text = cleanText(raw, 20);
  if (!text) return null;
  const parsed = parsePositiveIntId(text);
  return parsed ?? "bad";
};

const isFutureMonth = (year: number, month: number, today: Date) =>
  year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());

export function parseManualPnl(f: FormData): ParseResult<{ companyId: number; branchId: number | null; year: number; month: number; main: string; sub: string; value: number }> {
  const companyId = parsePositiveIntId(f.get("companyId"));
  if (!companyId) return { error: "Choose a company." };
  const branchId = optionalCompanyId(f.get("branchId"));
  if (branchId === "bad") return { error: "Invalid branch." };
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  const accountRaw = cleanText(f.get("account"), 180);
  const splitAt = accountRaw.indexOf("|");
  const main = splitAt > 0 ? cleanText(accountRaw.slice(0, splitAt), 80) : cleanText(f.get("main"), 80);
  const sub = splitAt > 0 ? cleanText(accountRaw.slice(splitAt + 1), 80) : cleanText(f.get("sub"), 80);
  if (!main || !sub) return { error: "Choose an account from the chart of accounts." };
  const value = parseRequiredAmount(f.get("value"), true);
  if (value === null) return { error: "Enter a valid amount in QAR." };
  return { data: { companyId, branchId, year: ym.year, month: ym.month, main, sub, value } };
}

export function parseManualMonthlyFigures(
  f: FormData,
  today = new Date(),
): ParseResult<{ section: GridSection; companyId: number; branchId: number | null; year: number; month: number; entries: { line: string; value: number }[] }> {
  const sectionRaw = cleanText(f.get("section"), 20);
  if (sectionRaw !== "sales" && sectionRaw !== "budget" && sectionRaw !== "people" && sectionRaw !== "expenses") {
    return { error: "Choose a valid monthly section." };
  }
  const section: GridSection = sectionRaw;
  const companyId = parsePositiveIntId(f.get("companyId"));
  if (!companyId) return { error: "Choose a company." };
  const branchId = optionalCompanyId(f.get("branchId"));
  if (branchId === "bad") return { error: "Invalid branch." };
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  if (section !== "budget" && isFutureMonth(ym.year, ym.month, today)) {
    return { error: `${MONTHS[ym.month]} ${ym.year} has not finished yet, so actuals cannot be submitted.` };
  }
  const lines = LINES[section];
  const entries: { line: string; value: number }[] = [];
  for (const line of lines) {
    const raw = f.get(`line_${line}`);
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) return { error: `Enter a value for ${line} (enter 0 for a verified zero).` };
    const isWhole = line === "Headcount" || line === "Joiners" || line === "Leavers";
    const num = isWhole ? Number(text.replaceAll(",", "")) : parseMoneyString(text);
    if (num === null || !Number.isFinite(num)) return { error: `${line}: enter a valid number.` };
    const problem = checkFigureCell(line, num);
    if (problem) return { error: `${line}: ${problem}` };
    entries.push({ line, value: isWhole ? num : roundMoney(num) });
  }
  return { data: { section, companyId, branchId, year: ym.year, month: ym.month, entries } };
}

export type ManualDailyStay = {
  companyId: number;
  branchId: number | null;
  date: string;
  long_guests: number;
  long_rate: number;
  long_total: number;
  short_guests: number;
  short_rate: number;
  short_total: number;
  rooms_occupied: number;
  room_revenue: number;
  other_revenue: number;
  rooms_available: number;
};

export function parseManualDailyStay(f: FormData, totalRooms = 0): ParseResult<ManualDailyStay> {
  const companyId = parsePositiveIntId(f.get("companyId"));
  if (!companyId) return { error: "Choose a real estate company." };
  const branchId = optionalCompanyId(f.get("branchId"));
  if (branchId === "bad") return { error: "Invalid branch." };
  const date = parseIsoDate(f.get("date"));
  if (!date) return { error: "Enter a valid date (YYYY-MM-DD)." };

  const numOrZero = (key: string, allowNegative = false): number | "bad" => {
    const parsed = parseOptionalAmount(f.get(key), allowNegative);
    return parsed === "bad" ? "bad" : (parsed ?? 0);
  };

  const longGuests = numOrZero("long_guests");
  const longRate = numOrZero("long_rate");
  const longTotal = numOrZero("long_total");
  const shortGuests = numOrZero("short_guests");
  const shortRate = numOrZero("short_rate");
  const shortTotal = numOrZero("short_total");
  const roomsOccupied = numOrZero("rooms_occupied");
  const roomRevenue = numOrZero("room_revenue", true);
  const otherRevenue = numOrZero("other_revenue", true);
  const roomsAvailable = numOrZero("rooms_available");

  if (
    longGuests === "bad" || longRate === "bad" || longTotal === "bad" ||
    shortGuests === "bad" || shortRate === "bad" || shortTotal === "bad" ||
    roomsOccupied === "bad" || roomRevenue === "bad" || otherRevenue === "bad" || roomsAvailable === "bad"
  ) {
    return { error: "Check that every stay figure is a valid number (guests, rates, and room counts cannot be negative)." };
  }
  if (roomsAvailable > 0 && roomsOccupied > roomsAvailable) {
    return { error: `${roomsOccupied} rooms occupied exceeds ${roomsAvailable} rooms available.` };
  }
  if (totalRooms > 0 && roomsAvailable > totalRooms) {
    return { error: `${roomsAvailable} rooms available exceeds the company's total rooms (${totalRooms}).` };
  }

  return {
    data: {
      companyId,
      branchId,
      date,
      long_guests: longGuests,
      long_rate: longRate,
      long_total: longTotal,
      short_guests: shortGuests,
      short_rate: shortRate,
      short_total: shortTotal,
      rooms_occupied: roomsOccupied,
      room_revenue: roomRevenue,
      other_revenue: otherRevenue,
      rooms_available: roomsAvailable,
    },
  };
}

export function parseManualUnitTypes(f: FormData): ParseResult<{ companyId: number; branchId: number | null; year: number; month: number; unitType: string; entries: { line: string; value: number }[] }> {
  const companyId = parsePositiveIntId(f.get("companyId"));
  if (!companyId) return { error: "Choose a company." };
  const branchId = optionalCompanyId(f.get("branchId"));
  if (branchId === "bad") return { error: "Invalid branch." };
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  const unitType = cleanText(f.get("unitType"), 40);
  if (!unitType) return { error: "Enter a unit type (for example 1 BHK or 2 BHK)." };

  const entries: { line: string; value: number }[] = [];
  for (const line of UNIT_METRIC_LINES) {
    const parsed = parseOptionalAmount(f.get(`unit_${line}`), line === "Room revenue");
    if (parsed === "bad") return { error: `${line}: enter a valid number.` };
    if (parsed !== undefined) entries.push({ line, value: parsed });
  }
  if (!entries.length) return { error: "Enter at least one unit-type figure." };
  return { data: { companyId, branchId, year: ym.year, month: ym.month, unitType, entries } };
}

export function parseManualDailyTakings(f: FormData): ParseResult<{ companyId: number; branchId: number; date: string; entries: { line: string; value: number }[] }> {
  const companyId = parsePositiveIntId(f.get("companyId"));
  if (!companyId) return { error: "Choose a company." };
  const branchId = parsePositiveIntId(f.get("branchId"));
  if (!branchId) return { error: "Choose a branch (daily takings are stored per branch)." };
  const date = parseIsoDate(f.get("date"));
  if (!date) return { error: "Enter a valid date (YYYY-MM-DD)." };

  const byLine = new Map<string, number>();
  for (const channel of STANDARD_RECEIPT_CHANNELS) {
    const parsed = parseOptionalAmount(f.get(`ch_${channel}`), true);
    if (parsed === "bad") return { error: `${channel}: enter a valid amount in QAR.` };
    if (parsed !== undefined) byLine.set(channel, parsed);
  }
  const customChannel = cleanText(f.get("customChannel"), 60);
  const customValue = parseOptionalAmount(f.get("customValue"), true);
  if (customValue === "bad") return { error: "Custom channel: enter a valid amount in QAR." };
  if (customChannel && customValue === undefined) return { error: `Enter an amount for "${customChannel}".` };
  if (!customChannel && customValue !== undefined) return { error: "Enter the custom payment channel name." };
  if (customChannel && customValue !== undefined) {
    const normalized = /^bank\s+deposits?$/i.test(customChannel) ? "Bank deposits" : customChannel;
    byLine.set(normalized, customValue);
  }
  if (!byLine.size) return { error: "Enter at least one payment channel amount." };
  return { data: { companyId, branchId, date, entries: [...byLine].map(([line, value]) => ({ line, value })) } };
}

export function parseManualCogs(f: FormData): ParseResult<{ companyId: number; branchId: number | null; year: number; month: number; entries: { line: string; value: number }[] }> {
  const companyId = parsePositiveIntId(f.get("companyId"));
  if (!companyId) return { error: "Choose a company." };
  const branchId = optionalCompanyId(f.get("branchId"));
  if (branchId === "bad") return { error: "Invalid branch." };
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };

  const entries: { line: string; value: number }[] = [];
  for (const [line, sign] of COGS_MANUAL_LINES) {
    const parsed = parseOptionalAmount(f.get(`cogs_${line}`), true);
    if (parsed === "bad") return { error: `${line}: enter a valid amount in QAR.` };
    if (parsed !== undefined) {
      // Cost/deduction lines in COGS (Discount, CPU transfer, COGS) are stored negative so Cost % and Net calculations match workbook imports.
      const signed = parsed === 0 ? 0 : sign < 0 ? -Math.abs(parsed) : parsed;
      entries.push({ line, value: roundMoney(signed) });
    }
  }
  if (!entries.length) return { error: "Enter at least one COGS figure." };
  return { data: { companyId, branchId, year: ym.year, month: ym.month, entries } };
}

export function parseManualSalesTarget(f: FormData): ParseResult<{ code: string; period: string; year: number; month: number; target: number }> {
  const code = cleanText(f.get("code"), 80);
  if (!code) return { error: "Choose a sales department." };
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  const target = parseRequiredAmount(f.get("target"), false);
  if (target === null) return { error: "Enter a valid non-negative target in QAR." };
  return { data: { code, period: ym.period, year: ym.year, month: ym.month, target } };
}

export function parseManualSalesIndicators(f: FormData): ParseResult<{ departmentCode: string; period: string; year: number; month: number; entries: { indicator: SalesIndicatorKey; value: number }[] }> {
  const departmentCode = cleanText(f.get("departmentCode"), 80);
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  const entries: { indicator: SalesIndicatorKey; value: number }[] = [];
  for (const [key, label] of SALES_INDICATORS) {
    const parsed = parseOptionalAmount(f.get(`ind_${key}`), true);
    if (parsed === "bad") return { error: `${label}: enter a valid number.` };
    if (parsed !== undefined) entries.push({ indicator: key, value: parsed });
  }
  if (!entries.length) return { error: "Enter at least one sales indicator value." };
  return { data: { departmentCode, period: ym.period, year: ym.year, month: ym.month, entries } };
}

export function parseManualBrand(f: FormData): ParseResult<{ code: string; name: string; department: string | null; manager: string | null; category: string | null }> {
  const name = cleanText(f.get("name"), 120);
  const rawCode = cleanText(f.get("code"), 60) || name;
  const code = rawCode.toUpperCase();
  if (!code || !name) return { error: "Brand name is required." };
  return {
    data: {
      code,
      name,
      department: cleanText(f.get("department"), 80) || null,
      manager: cleanText(f.get("manager"), 80) || null,
      category: cleanText(f.get("category"), 80) || null,
    },
  };
}

export function parseManualSalesman(f: FormData): ParseResult<{ code: string; name: string; status: string; teamLead: string | null; manager: string | null; salesCategory: string | null; route: string | null }> {
  const rawCode = cleanText(f.get("code"), 40);
  const name = cleanText(f.get("name"), 120);
  if (!rawCode || !name) return { error: "Salesman code and name are required." };
  const code = /^\d+$/.test(rawCode) ? rawCode.padStart(3, "0") : rawCode.toUpperCase();
  const status = cleanText(f.get("status"), 20) === "Inactive" ? "Inactive" : "Active";
  return {
    data: {
      code,
      name,
      status,
      teamLead: cleanText(f.get("teamLead"), 80) || null,
      manager: cleanText(f.get("manager"), 80) || null,
      salesCategory: cleanText(f.get("salesCategory"), 80) || null,
      route: cleanText(f.get("route"), 80) || null,
    },
  };
}

export function parseManualFmcgCustomer(f: FormData): ParseResult<{ code: string; name: string; groupName: string | null; creditDays: number | null; accountant: string | null; status: string; balance: number | null }> {
  const code = cleanText(f.get("code"), 40).toUpperCase();
  const name = cleanText(f.get("name"), 160);
  if (!code || !name) return { error: "Customer code and name are required." };
  const creditRaw = cleanText(f.get("creditDays"), 10);
  const creditDays = creditRaw ? parseNonNegativeInt(creditRaw, 3650) : null;
  if (creditRaw && creditDays === null) return { error: "Credit days must be a whole number." };
  const balance = parseOptionalAmount(f.get("balance"), true);
  if (balance === "bad") return { error: "Balance must be a valid amount in QAR." };
  const status = cleanText(f.get("status"), 20) === "Inactive" ? "Inactive" : "Active";
  return {
    data: {
      code,
      name,
      groupName: cleanText(f.get("groupName"), 120) || null,
      creditDays,
      accountant: cleanText(f.get("accountant"), 80) || null,
      status,
      balance: balance ?? null,
    },
  };
}

export function parseManualFmcgItem(f: FormData): ParseResult<{ code: string; name: string; brand: string; packing: string | null; size: string | null; itemType: string | null; department: string | null; manager: string | null }> {
  const code = cleanText(f.get("code"), 40);
  const name = cleanText(f.get("name"), 160);
  const brand = cleanText(f.get("brand"), 80).toUpperCase();
  if (!code || !name || !brand) return { error: "Item code, description, and brand are required." };
  return {
    data: {
      code,
      name,
      brand,
      packing: cleanText(f.get("packing"), 60) || null,
      size: cleanText(f.get("size"), 60) || null,
      itemType: cleanText(f.get("itemType"), 60) || null,
      department: cleanText(f.get("department"), 80) || null,
      manager: cleanText(f.get("manager"), 80) || null,
    },
  };
}

export function parseManualSalesAssignment(f: FormData): ParseResult<{ period: string; salesmanCode: string; salesmanName: string; brand: string; supervisor: string | null; channel: string | null; department: string | null; target: number }> {
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  const rawCode = cleanText(f.get("salesmanCode"), 40);
  const salesmanName = cleanText(f.get("salesmanName"), 120) || rawCode;
  const brand = cleanText(f.get("brand"), 80).toUpperCase();
  if (!rawCode || !brand) return { error: "Salesman code and brand are required." };
  const salesmanCode = /^\d+$/.test(rawCode) ? rawCode.padStart(3, "0") : rawCode.toUpperCase();
  const target = parseRequiredAmount(f.get("target"), false);
  if (target === null) return { error: "Enter a valid target in QAR." };
  return {
    data: {
      period: ym.period,
      salesmanCode,
      salesmanName,
      brand,
      supervisor: cleanText(f.get("supervisor"), 80) || null,
      channel: cleanText(f.get("channel"), 80) || null,
      department: cleanText(f.get("department"), 80) || null,
      target,
    },
  };
}

export function parseManualManagerTarget(f: FormData): ParseResult<{ period: string; manager: string; target: number }> {
  const ym = parseYearMonth(f.get("year"), f.get("month"));
  if (!ym) return { error: "Choose a valid year and month." };
  const manager = cleanText(f.get("manager"), 120);
  if (!manager) return { error: "Manager name is required." };
  const target = parseRequiredAmount(f.get("target"), false);
  if (target === null) return { error: "Enter a valid target in QAR." };
  return { data: { period: ym.period, manager, target } };
}

export function parseManualStockSnapshot(f: FormData): ParseResult<{ asOf: string; itemCode: string; itemName: string; brand: string; location: string; qtyCurrent: number; qtyAllocated: number; qtyBalance: number; value: number }> {
  const asOf = parseIsoDate(f.get("asOf"));
  if (!asOf) return { error: "Enter a valid stock date (YYYY-MM-DD)." };
  const itemCode = cleanText(f.get("itemCode"), 40);
  const itemName = cleanText(f.get("itemName"), 160) || itemCode;
  const brand = cleanText(f.get("brand"), 80).toUpperCase() || "GENERAL";
  const location = cleanText(f.get("location"), 80);
  if (!itemCode || !location) return { error: "Item code and warehouse location are required." };
  const qtyCurrent = parseOptionalAmount(f.get("qtyCurrent"), true);
  const qtyAllocated = parseOptionalAmount(f.get("qtyAllocated"), true);
  const qtyBalance = parseRequiredAmount(f.get("qtyBalance"), true);
  const value = parseRequiredAmount(f.get("value"), true);
  if (qtyCurrent === "bad" || qtyAllocated === "bad" || qtyBalance === null || value === null) {
    return { error: "Enter valid quantities and stock value in QAR." };
  }
  return {
    data: {
      asOf,
      itemCode,
      itemName,
      brand,
      location,
      qtyCurrent: qtyCurrent ?? qtyBalance,
      qtyAllocated: qtyAllocated ?? 0,
      qtyBalance,
      value,
    },
  };
}

export function parseManualDeliveryVariance(f: FormData): ParseResult<{
  doDate: string; doNo: string; itemCode: string; location: string; customerCode: string | null; customer: string | null;
  salesman: string | null; storeInCharge: string | null; driver: string | null; item: string | null; brand: string | null;
  manager: string | null; supervisor: string | null; qtyRv: number; qtyDo: number; valueRv: number; valueDo: number;
}> {
  const doDate = parseIsoDate(f.get("doDate"));
  const doNo = cleanText(f.get("doNo"), 60);
  const itemCode = cleanText(f.get("itemCode"), 40);
  const location = cleanText(f.get("location"), 80);
  if (!doDate || !doNo || !itemCode || !location) return { error: "DO date, DO number, item code, and location are required." };
  const qtyRv = parseRequiredAmount(f.get("qtyRv"), true);
  const qtyDo = parseRequiredAmount(f.get("qtyDo"), true);
  const valueRv = parseRequiredAmount(f.get("valueRv"), true);
  const valueDo = parseRequiredAmount(f.get("valueDo"), true);
  if (qtyRv === null || qtyDo === null || valueRv === null || valueDo === null) {
    return { error: "Enter valid RV and DO quantities and amounts in QAR." };
  }
  return {
    data: {
      doDate,
      doNo,
      itemCode,
      location,
      customerCode: cleanText(f.get("customerCode"), 40) || null,
      customer: cleanText(f.get("customer"), 160) || null,
      salesman: cleanText(f.get("salesman"), 80) || null,
      storeInCharge: cleanText(f.get("storeInCharge"), 80) || null,
      driver: cleanText(f.get("driver"), 80) || null,
      item: cleanText(f.get("item"), 160) || null,
      brand: cleanText(f.get("brand"), 80) || null,
      manager: cleanText(f.get("manager"), 80) || null,
      supervisor: cleanText(f.get("supervisor"), 80) || null,
      qtyRv,
      qtyDo,
      valueRv,
      valueDo,
    },
  };
}

export function parseManualConsignment(f: FormData): ParseResult<{
  receivedDate: string; lineNo: number; consignmentNo: string; orderNo: string | null; invoiceNo: string | null;
  invoiceDate: string | null; supplier: string | null; location: string | null; itemCode: string; item: string | null;
  expiryDate: string | null; excise: string | null; billedQty: number; receivedQty: number;
}> {
  const receivedDate = parseIsoDate(f.get("receivedDate"));
  const lineNo = parsePositiveIntId(f.get("lineNo") || "1");
  const consignmentNo = cleanText(f.get("consignmentNo"), 60);
  const itemCode = cleanText(f.get("itemCode"), 40);
  if (!receivedDate || !lineNo || !consignmentNo || !itemCode) {
    return { error: "Received date, line number, consignment number, and item code are required." };
  }
  const invoiceDateRaw = cleanText(f.get("invoiceDate"), 20);
  const invoiceDate = invoiceDateRaw ? parseIsoDate(invoiceDateRaw) : null;
  if (invoiceDateRaw && !invoiceDate) return { error: "Invoice date must be YYYY-MM-DD." };
  const expiryDateRaw = cleanText(f.get("expiryDate"), 20);
  const expiryDate = expiryDateRaw ? parseIsoDate(expiryDateRaw) : null;
  if (expiryDateRaw && !expiryDate) return { error: "Expiry date must be YYYY-MM-DD." };
  const billedQty = parseRequiredAmount(f.get("billedQty"), false);
  const receivedQty = parseRequiredAmount(f.get("receivedQty"), false);
  if (billedQty === null || receivedQty === null) return { error: "Enter valid billed and received quantities." };
  return {
    data: {
      receivedDate,
      lineNo,
      consignmentNo,
      orderNo: cleanText(f.get("orderNo"), 60) || null,
      invoiceNo: cleanText(f.get("invoiceNo"), 60) || null,
      invoiceDate,
      supplier: cleanText(f.get("supplier"), 120) || null,
      location: cleanText(f.get("location"), 80) || null,
      itemCode,
      item: cleanText(f.get("item"), 160) || null,
      expiryDate,
      excise: cleanText(f.get("excise"), 20) || null,
      billedQty,
      receivedQty,
    },
  };
}

export function parseManualStockExpiry(f: FormData): ParseResult<{
  asOf: string; report: string; lineNo: number; itemCode: string; item: string | null; size: string | null;
  packing: string | null; brand: string | null; category: string | null; location: string | null;
  cartons: number | null; outers: number | null; pieces: number | null; totalCost: number; expiryDate: string; remarks: string | null;
}> {
  const asOf = parseIsoDate(f.get("asOf"));
  const report = cleanText(f.get("report"), 80);
  const lineNo = parsePositiveIntId(f.get("lineNo") || "1");
  const itemCode = cleanText(f.get("itemCode"), 40);
  const expiryDate = parseIsoDate(f.get("expiryDate"));
  if (!asOf || !report || !lineNo || !itemCode || !expiryDate) {
    return { error: "Report date, department/report name, line number, item code, and expiry date are required." };
  }
  const cartons = parseOptionalAmount(f.get("cartons"), false);
  const outers = parseOptionalAmount(f.get("outers"), false);
  const pieces = parseOptionalAmount(f.get("pieces"), false);
  const totalCost = parseRequiredAmount(f.get("totalCost"), false);
  if (cartons === "bad" || outers === "bad" || pieces === "bad" || totalCost === null) {
    return { error: "Enter valid carton/outer/piece counts and total cost in QAR." };
  }
  return {
    data: {
      asOf,
      report,
      lineNo,
      itemCode,
      item: cleanText(f.get("item"), 160) || null,
      size: cleanText(f.get("size"), 40) || null,
      packing: cleanText(f.get("packing"), 40) || null,
      brand: cleanText(f.get("brand"), 80) || null,
      category: cleanText(f.get("category"), 80) || null,
      location: cleanText(f.get("location"), 80) || null,
      cartons: cartons ?? null,
      outers: outers ?? null,
      pieces: pieces ?? null,
      totalCost,
      expiryDate,
      remarks: cleanText(f.get("remarks"), 200) || null,
    },
  };
}

export function parseManualReceivablesSnapshot(f: FormData): ParseResult<{
  companyId: number | null; asOf: string; dsoDays: number | null;
  notDue: number; days1To30: number; days31To60: number; days61To90: number; over90: number;
}> {
  const companyId = optionalCompanyId(f.get("companyId"));
  if (companyId === "bad") return { error: "Invalid company." };
  const asOf = parseIsoDate(f.get("asOf"));
  if (!asOf) return { error: "Enter a valid as-of date (YYYY-MM-DD)." };
  const dsoDays = parseOptionalAmount(f.get("dsoDays"), false);
  const notDue = parseOptionalAmount(f.get("notDue"), true);
  const days1To30 = parseOptionalAmount(f.get("days1To30"), true);
  const days31To60 = parseOptionalAmount(f.get("days31To60"), true);
  const days61To90 = parseOptionalAmount(f.get("days61To90"), true);
  const over90 = parseOptionalAmount(f.get("over90"), true);
  if (dsoDays === "bad" || notDue === "bad" || days1To30 === "bad" || days31To60 === "bad" || days61To90 === "bad" || over90 === "bad") {
    return { error: "Enter valid DSO days and aging bucket amounts in QAR." };
  }
  return {
    data: {
      companyId,
      asOf,
      dsoDays: dsoDays ?? null,
      notDue: notDue ?? 0,
      days1To30: days1To30 ?? 0,
      days31To60: days31To60 ?? 0,
      days61To90: days61To90 ?? 0,
      over90: over90 ?? 0,
    },
  };
}

export function parseManualOverdueInvoice(f: FormData): ParseResult<{
  invoiceNo: string; accountName: string; companyId: number | null; dueDate: string; amount: number; balance: number; status: string;
}> {
  const invoiceNo = cleanText(f.get("invoiceNo"), 60);
  const accountName = cleanText(f.get("accountName"), 160);
  const companyId = optionalCompanyId(f.get("companyId"));
  if (companyId === "bad") return { error: "Invalid company." };
  const dueDate = parseIsoDate(f.get("dueDate"));
  if (!invoiceNo || !accountName || !dueDate) return { error: "Invoice number, account name, and due date are required." };
  const amount = parseRequiredAmount(f.get("amount"), false);
  const balance = parseRequiredAmount(f.get("balance"), false);
  if (amount === null || balance === null) return { error: "Enter valid non-negative invoice amount and balance in QAR." };
  const status = cleanText(f.get("status"), 40) || "Overdue";
  return { data: { invoiceNo, accountName, companyId, dueDate, amount, balance, status } };
}

export function parseManualCustomerOpportunity(f: FormData): ParseResult<{
  customerCode: string; customerName: string; title: string; stage: string; value: number; expectedClose: string | null; owner: string; notes: string;
}> {
  const customerCode = cleanText(f.get("customerCode"), 60);
  const customerName = cleanText(f.get("customerName"), 160);
  const title = cleanText(f.get("title"), 160);
  if (!customerName || !title) return { error: "Customer name and opportunity title are required." };
  const stage = cleanText(f.get("stage"), 40) || "Qualification";
  const value = parseOptionalAmount(f.get("value"), false);
  if (value === "bad") return { error: "Opportunity value must be a non-negative amount in QAR." };
  const closeRaw = cleanText(f.get("expectedClose"), 20);
  const expectedClose = closeRaw ? parseIsoDate(closeRaw) : null;
  if (closeRaw && !expectedClose) return { error: "Expected close date must be YYYY-MM-DD." };
  return {
    data: {
      customerCode,
      customerName,
      title,
      stage,
      value: value ?? 0,
      expectedClose,
      owner: cleanText(f.get("owner"), 80),
      notes: cleanMultilineText(f.get("notes"), 500),
    },
  };
}

export function parseManualEmployee(f: FormData): ParseResult<{
  id: string; name: string; department: string; designation: string; nationality: string; joined: string; left: string | null;
}> {
  const id = cleanText(f.get("id"), 40);
  const name = cleanText(f.get("name"), 120);
  const joined = parseIsoDate(f.get("joined"));
  if (!id || !name || !joined) return { error: "Employee ID, name, and joining date are required." };
  const leftRaw = cleanText(f.get("left"), 20);
  const left = leftRaw ? parseIsoDate(leftRaw) : null;
  if (leftRaw && !left) return { error: "Resign / leave date must be YYYY-MM-DD." };
  if (left && left < joined) return { error: "Resign / leave date cannot be earlier than joining date." };
  return {
    data: {
      id,
      name,
      department: cleanText(f.get("department"), 80),
      designation: cleanText(f.get("designation"), 80),
      nationality: cleanText(f.get("nationality"), 80),
      joined,
      left,
    },
  };
}

export function parseManualLeaveRequest(f: FormData): ParseResult<{
  employeeId: string; employeeName: string; companyId: number | null; leaveType: string; startDate: string; endDate: string; days: number; status: string;
}> {
  const employeeId = cleanText(f.get("employeeId"), 40);
  const employeeName = cleanText(f.get("employeeName"), 120);
  const companyId = optionalCompanyId(f.get("companyId"));
  if (companyId === "bad") return { error: "Invalid company." };
  const leaveType = cleanText(f.get("leaveType"), 40) || "Annual";
  const startDate = parseIsoDate(f.get("startDate"));
  const endDate = parseIsoDate(f.get("endDate"));
  if (!employeeName || !startDate || !endDate) return { error: "Employee name, start date, and end date are required." };
  if (endDate < startDate) return { error: "End date cannot be earlier than start date." };
  const days = parseRequiredAmount(f.get("days"), false);
  if (days === null || days <= 0 || days > 366) return { error: "Leave days must be between 0.5 and 366." };
  const status = cleanText(f.get("status"), 40) || "Pending";
  return { data: { employeeId, employeeName, companyId, leaveType, startDate, endDate, days, status } };
}

export function parseManualExpiringDocument(f: FormData): ParseResult<{
  employeeId: string; holderName: string; companyId: number | null; documentType: string; documentNo: string; expiryDate: string; status: string;
}> {
  const employeeId = cleanText(f.get("employeeId"), 40);
  const holderName = cleanText(f.get("holderName"), 120);
  const companyId = optionalCompanyId(f.get("companyId"));
  if (companyId === "bad") return { error: "Invalid company." };
  const documentType = cleanText(f.get("documentType"), 60);
  const documentNo = cleanText(f.get("documentNo"), 60);
  const expiryDate = parseIsoDate(f.get("expiryDate"));
  if (!holderName || !documentType || !expiryDate) return { error: "Holder name, document type, and expiry date are required." };
  const status = cleanText(f.get("status"), 40) || "Expiring soon";
  return { data: { employeeId, holderName, companyId, documentType, documentNo, expiryDate, status } };
}

export function parseManualLogisticsKpis(f: FormData): ParseResult<{ fleetCount: number | null; onRouteCount: number | null; outletsReached: number | null }> {
  const optInt = (key: string): number | null | "bad" => {
    const text = cleanText(f.get(key), 15);
    if (!text) return null;
    const parsed = parseNonNegativeInt(text);
    return parsed ?? "bad";
  };
  const fleetCount = optInt("fleetCount");
  const onRouteCount = optInt("onRouteCount");
  const outletsReached = optInt("outletsReached");
  if (fleetCount === "bad" || onRouteCount === "bad" || outletsReached === "bad") {
    return { error: "Fleet, on-route, and outlets-reached counts must be non-negative whole numbers." };
  }
  return { data: { fleetCount, onRouteCount, outletsReached } };
}

export function parseManualFleetVehicle(f: FormData): ParseResult<{
  vehicleNo: string; vehicleType: string; driverName: string; route: string; temperatureMode: string; status: string;
}> {
  const vehicleNo = cleanText(f.get("vehicleNo"), 40);
  if (!vehicleNo) return { error: "Vehicle / plate number is required." };
  return {
    data: {
      vehicleNo,
      vehicleType: cleanText(f.get("vehicleType"), 60),
      driverName: cleanText(f.get("driverName"), 100),
      route: cleanText(f.get("route"), 100),
      temperatureMode: cleanText(f.get("temperatureMode"), 40) || "Dry",
      status: cleanText(f.get("status"), 40) || "On route",
    },
  };
}

export function parseManualShipment(f: FormData): ParseResult<{
  shipmentCode: string; destination: string; temperature: string; vehicle: string; eta: string; status: string;
}> {
  const shipmentCode = cleanText(f.get("shipmentCode"), 40);
  const destination = cleanText(f.get("destination"), 120);
  if (!shipmentCode || !destination) return { error: "Shipment ID and destination are required." };
  return {
    data: {
      shipmentCode,
      destination,
      temperature: cleanText(f.get("temperature"), 40),
      vehicle: cleanText(f.get("vehicle"), 60),
      eta: cleanText(f.get("eta"), 60),
      status: cleanText(f.get("status"), 40) || "In transit",
    },
  };
}

export function parseManualWarehouse(f: FormData): ParseResult<{
  name: string; location: string; temperatureZone: string; capacityPallets: number; occupiedPallets: number; status: string;
}> {
  const name = cleanText(f.get("name"), 100);
  if (!name) return { error: "Warehouse name is required." };
  const capacityPallets = parseNonNegativeInt(f.get("capacityPallets"), 10_000_000, true);
  const occupiedPallets = parseNonNegativeInt(f.get("occupiedPallets"), 10_000_000, true);
  if (capacityPallets === null || occupiedPallets === null) {
    return { error: "Capacity and occupied pallets must be non-negative whole numbers." };
  }
  return {
    data: {
      name,
      location: cleanText(f.get("location"), 100),
      temperatureZone: cleanText(f.get("temperatureZone"), 40) || "Dry",
      capacityPallets,
      occupiedPallets,
      status: cleanText(f.get("status"), 40) || "Operational",
    },
  };
}

export function parseManualCustoms(f: FormData): ParseResult<{
  bolNo: string; customer: string; port: string; eta: string | null; status: string;
}> {
  const bolNo = cleanText(f.get("bolNo"), 60);
  const customer = cleanText(f.get("customer"), 140);
  if (!bolNo || !customer) return { error: "Bill of lading number and customer are required." };
  const etaRaw = cleanText(f.get("eta"), 20);
  const eta = etaRaw ? parseIsoDate(etaRaw) : null;
  if (etaRaw && !eta) return { error: "ETA date must be YYYY-MM-DD." };
  return {
    data: {
      bolNo,
      customer,
      port: cleanText(f.get("port"), 80),
      eta,
      status: cleanText(f.get("status"), 40) || "Pending",
    },
  };
}

