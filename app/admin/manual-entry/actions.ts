"use server";
import { revalidatePath, updateTag } from "next/cache";
import { listAccounts } from "@/lib/accounts";
import { branchName, branchOf } from "@/lib/branches";
import { getCompany } from "@/lib/companies";
import { MONTHS, sectionName } from "@/lib/company-data";
import { deleteFigureMonth, setFigure } from "@/lib/company-figures";
import { addLog } from "@/lib/db";
import { GuardError, requireAdmin } from "@/lib/guard";
import { cleanText, parsePositiveIntId } from "@/lib/input-validation";
import {
  parseIsoDate,
  parseManualBrand,
  parseManualCogs,
  parseManualConsignment,
  parseManualCustoms,
  parseManualDailyStay,
  parseManualDailyTakings,
  parseManualDeliveryVariance,
  parseManualEmployee,
  parseManualFleetVehicle,
  parseManualFmcgCustomer,
  parseManualFmcgItem,
  parseManualLogisticsKpis,
  parseManualManagerTarget,
  parseManualMonthlyFigures,
  parseManualOverdueInvoice,
  parseManualPnl,
  parseManualReceivablesSnapshot,
  parseManualSalesAssignment,
  parseManualSalesIndicators,
  parseManualSalesman,
  parseManualSalesTarget,
  parseManualShipment,
  parseManualStockExpiry,
  parseManualStockSnapshot,
  parseManualUnitTypes,
  parseManualWarehouse,
  parseYearMonth,
} from "@/lib/manual-entry-input";
import {
  deleteCogsMonthEntries,
  deleteCompanyFigureEntry,
  deleteCustomsClearance,
  deleteDailyReceiptEntry,
  deleteDailyStayRow,
  deleteEmployeeRecord,
  deleteFmcgBrand,
  deleteFmcgConsignment,
  deleteFmcgCustomer,
  deleteFmcgDeliveryVariance,
  deleteFmcgItem,
  deleteFmcgManagerTarget,
  deleteFmcgSalesAssignment,
  deleteFmcgSalesman,
  deleteFmcgStockExpiry,
  deleteFmcgStockSnapshot,
  deleteOverdueInvoice,
  deleteReceivablesSnapshot,
  deleteShipment,
  deleteUnitTypesMonth,
  deleteWarehouse,
  deleteFleetVehicle,
  saveCogsMonthEntries,
  saveCustomsClearance,
  saveDailyReceiptDay,
  saveDailyStayRow,
  saveFleetVehicle,
  saveFmcgBrand,
  saveFmcgConsignment,
  saveFmcgCustomer,
  saveFmcgDeliveryVariance,
  saveFmcgItem,
  saveFmcgManagerTarget,
  saveFmcgSalesAssignment,
  saveFmcgSalesman,
  saveFmcgStockExpiry,
  saveFmcgStockSnapshot,
  saveLogisticsKpis,
  saveManualEmployeeRecord,
  saveManualMonthlySection,
  saveOverdueInvoice,
  saveReceivablesSnapshot,
  saveShipment,
  saveUnitTypesMonth,
  saveWarehouse,
} from "@/lib/manual-report-records";
import { roundMoney } from "@/lib/money";
import { SECTOR } from "@/lib/org";
import { REPORTS_CACHE_TAG } from "@/lib/reports";
import {
  deleteSalesDepartmentTarget,
  deleteSalesSectorIndicator,
  SALES_CACHE_TAG,
  saveSalesDepartmentTarget,
  saveSalesSectorIndicators,
} from "@/lib/sales-targets";

export type ManualActionState = { error?: string; ok?: string };

function refreshCompanyReports(companyId?: number) {
  updateTag(REPORTS_CACHE_TAG);
  const paths = [
    "/admin/manual-entry",
    "/admin/data-status",
    "/admin/finance",
    "/admin/companies",
    "/admin/activity",
    "/dashboard",
    "/sales",
    "/finance",
    "/finance/pnl",
    "/real-estate",
    "/real-estate/overview",
    "/real-estate/details",
    "/restaurants",
    "/health-beauty",
    "/retail",
  ];
  if (companyId) paths.push(`/admin/companies/${companyId}`);
  for (const p of paths) revalidatePath(p);
}

function refreshRoutes(...paths: string[]) {
  if (paths.some((p) => p === "/sales" || p === "/finance" || p === "/logistics" || p === "/products")) {
    updateTag(SALES_CACHE_TAG);
  }
  for (const p of ["/admin/manual-entry", "/admin/activity", ...paths]) revalidatePath(p);
}

async function resolveOptionalCompany(companyId: number | null) {
  if (companyId === null) return { ok: true as const, id: null };
  const company = await getCompany(companyId);
  if (!company) return { ok: false as const };
  return { ok: true as const, id: company.id, name: company.name };
}

export async function saveManualPnlAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualPnl(f);
  if ("error" in parsed) return parsed;
  const { companyId, branchId, year, month, main, sub, value } = parsed.data;
  const company = await getCompany(companyId);
  if (!company) return { error: "Company not found." };
  const verifiedBranch = await branchOf(company.id, branchId);
  if (verifiedBranch === undefined) return { error: "Branch does not belong to the selected company." };
  const account = (await listAccounts()).find((a) => a.main === main && a.sub === sub);
  if (!account) return { error: "Account not found in the chart of accounts." };

  const autoSign = f.get("autoSign") === "1";
  const signedValue =
    value === 0 ? 0 : autoSign ? roundMoney(account.normal_sign < 0 ? -Math.abs(value) : Math.abs(value)) : value;

  const refused = await setFigure(company.id, "pnl", year, month, account.main, account.sub, "", signedValue, verifiedBranch);
  if (refused) return { error: refused };
  await addLog(`${company.name}: manual P&L ${account.main} / ${account.sub} ${MONTHS[month]} ${year} set to ${signedValue}`);
  refreshCompanyReports(company.id);
  return { ok: `Saved ${account.main} · ${account.sub} for ${MONTHS[month]} ${year} (${signedValue} QAR).` };
}

export async function saveManualMonthlyAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualMonthlyFigures(f, new Date());
  if ("error" in parsed) return parsed;
  const { section, companyId, branchId, year, month, entries } = parsed.data;
  const company = await getCompany(companyId);
  if (!company) return { error: "Company not found." };
  if (section === "sales" && company.sector === SECTOR.realEstate) {
    return { error: "Real estate monthly sales are calculated automatically from the Daily Stay report." };
  }
  const verifiedBranch = await branchOf(company.id, branchId);
  if (verifiedBranch === undefined) return { error: "Branch does not belong to the selected company." };

  const refused = await saveManualMonthlySection(company.id, section, year, month, entries, verifiedBranch);
  if (refused) return { error: refused };
  await addLog(`${company.name}: manual ${sectionName(section)} ${MONTHS[month]} ${year} saved`, true, entries.length);
  refreshCompanyReports(company.id);
  return { ok: `Saved ${sectionName(section)} for ${company.name} (${MONTHS[month]} ${year}).` };
}

export async function saveManualDailyStayAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const rawCompanyId = parsePositiveIntId(f.get("companyId"));
  if (!rawCompanyId) return { error: "Choose a company." };
  const company = await getCompany(rawCompanyId);
  if (!company) return { error: "Company not found." };
  const parsed = parseManualDailyStay(f, company.total_rooms);
  if ("error" in parsed) return parsed;
  const verifiedBranch = await branchOf(company.id, parsed.data.branchId);
  if (verifiedBranch === undefined) return { error: "Branch does not belong to the selected company." };

  await saveDailyStayRow({ ...parsed.data, companyId: company.id, branchId: verifiedBranch });
  await addLog(`${company.name}: manual daily stay ${parsed.data.date} saved`, true, 1);
  refreshCompanyReports(company.id);
  return { ok: `Saved daily stay figures for ${company.name} on ${parsed.data.date}.` };
}

export async function saveManualUnitTypesAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualUnitTypes(f);
  if ("error" in parsed) return parsed;
  const { companyId, branchId, year, month, unitType, entries } = parsed.data;
  const company = await getCompany(companyId);
  if (!company) return { error: "Company not found." };
  const verifiedBranch = await branchOf(company.id, branchId);
  if (verifiedBranch === undefined) return { error: "Branch does not belong to the selected company." };

  const refused = await saveUnitTypesMonth(company.id, year, month, unitType, entries, verifiedBranch);
  if (refused) return { error: refused };
  await addLog(`${company.name}: manual unit types (${unitType}) ${MONTHS[month]} ${year} saved`, true, entries.length);
  refreshCompanyReports(company.id);
  return { ok: `Saved ${unitType} figures for ${MONTHS[month]} ${year}.` };
}

export async function saveManualDailyTakingsAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualDailyTakings(f);
  if ("error" in parsed) return parsed;
  const { companyId, branchId, date, entries } = parsed.data;
  const company = await getCompany(companyId);
  if (!company) return { error: "Company not found." };
  const verifiedBranch = await branchOf(company.id, branchId);
  if (!verifiedBranch) return { error: "Choose a valid branch belonging to this company." };

  const refused = await saveDailyReceiptDay(company.id, verifiedBranch, date, entries);
  if (refused) return { error: refused };
  const bName = await branchName(verifiedBranch);
  await addLog(`${company.name} (${bName}): manual daily takings ${date} saved`, true, entries.length);
  refreshCompanyReports(company.id);
  return { ok: `Saved ${entries.length} channel figure${entries.length > 1 ? "s" : ""} for ${bName} on ${date}.` };
}

export async function saveManualCogsAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualCogs(f);
  if ("error" in parsed) return parsed;
  const { companyId, branchId, year, month, entries } = parsed.data;
  const company = await getCompany(companyId);
  if (!company) return { error: "Company not found." };
  const verifiedBranch = await branchOf(company.id, branchId);
  if (verifiedBranch === undefined) return { error: "Branch does not belong to the selected company." };

  const refused = await saveCogsMonthEntries(company.id, year, month, entries, verifiedBranch);
  if (refused) return { error: refused };
  await addLog(`${company.name}: manual COGS ${MONTHS[month]} ${year} saved`, true, entries.length);
  refreshCompanyReports(company.id);
  return { ok: `Saved ${entries.length} COGS figure${entries.length > 1 ? "s" : ""} for ${MONTHS[month]} ${year}.` };
}

export async function saveManualSalesTargetAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualSalesTarget(f);
  if ("error" in parsed) return parsed;
  const { code, period, year, month, target } = parsed.data;
  await saveSalesDepartmentTarget(code, period, target);
  await addLog(`Sales target ${code} ${MONTHS[month]} ${year} set to ${target} QAR`);
  refreshRoutes("/sales", "/finance");
  return { ok: `Saved target for ${code} (${MONTHS[month]} ${year}).` };
}

export async function saveManualSalesIndicatorsAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const parsed = parseManualSalesIndicators(f);
  if ("error" in parsed) return parsed;
  const { departmentCode, period, year, month, entries } = parsed.data;
  await saveSalesSectorIndicators(departmentCode, period, entries);
  await addLog(`Sales sector indicators (${departmentCode || "All"}) ${MONTHS[month]} ${year} saved`, true, entries.length);
  refreshRoutes("/sales");
  return { ok: `Saved ${entries.length} indicator${entries.length > 1 ? "s" : ""} for ${MONTHS[month]} ${year}.` };
}

export async function saveManualFmcgAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const kind = cleanText(f.get("fmcgKind"), 40);
  if (kind === "brand") {
    const parsed = parseManualBrand(f);
    if ("error" in parsed) return parsed;
    await saveFmcgBrand(parsed.data);
    await addLog(`FMCG brand ${parsed.data.code} saved`);
    refreshRoutes("/sales", "/products");
    return { ok: `Saved brand ${parsed.data.code} (${parsed.data.name}).` };
  }
  if (kind === "salesman") {
    const parsed = parseManualSalesman(f);
    if ("error" in parsed) return parsed;
    await saveFmcgSalesman(parsed.data);
    await addLog(`FMCG salesman ${parsed.data.code} saved`);
    refreshRoutes("/sales", "/hr");
    return { ok: `Saved salesman ${parsed.data.code} (${parsed.data.name}).` };
  }
  if (kind === "customer") {
    const parsed = parseManualFmcgCustomer(f);
    if ("error" in parsed) return parsed;
    await saveFmcgCustomer(parsed.data);
    await addLog(`FMCG customer ${parsed.data.code} saved`);
    refreshRoutes("/customers");
    return { ok: `Saved customer ${parsed.data.code} (${parsed.data.name}).` };
  }
  if (kind === "item") {
    const parsed = parseManualFmcgItem(f);
    if ("error" in parsed) return parsed;
    await saveFmcgItem(parsed.data);
    await addLog(`FMCG item ${parsed.data.code} saved`);
    refreshRoutes("/products");
    return { ok: `Saved item ${parsed.data.code} (${parsed.data.name}).` };
  }
  if (kind === "assignment") {
    const parsed = parseManualSalesAssignment(f);
    if ("error" in parsed) return parsed;
    await saveFmcgSalesAssignment(parsed.data);
    await addLog(`FMCG salesman target ${parsed.data.salesmanCode} / ${parsed.data.brand} (${parsed.data.period.slice(0, 7)}) saved`);
    refreshRoutes("/sales");
    return { ok: `Saved target for salesman ${parsed.data.salesmanCode} · ${parsed.data.brand}.` };
  }
  if (kind === "managerTarget") {
    const parsed = parseManualManagerTarget(f);
    if ("error" in parsed) return parsed;
    await saveFmcgManagerTarget(parsed.data);
    await addLog(`FMCG manager target ${parsed.data.manager} (${parsed.data.period.slice(0, 7)}) saved`);
    refreshRoutes("/sales");
    return { ok: `Saved manager target for ${parsed.data.manager}.` };
  }
  if (kind === "stockSnapshot") {
    const parsed = parseManualStockSnapshot(f);
    if ("error" in parsed) return parsed;
    await saveFmcgStockSnapshot(parsed.data);
    await addLog(`FMCG stock snapshot ${parsed.data.itemCode} @ ${parsed.data.location} (${parsed.data.asOf}) saved`);
    refreshRoutes("/products", "/logistics");
    return { ok: `Saved stock snapshot for ${parsed.data.itemCode} at ${parsed.data.location}.` };
  }
  if (kind === "deliveryVariance") {
    const parsed = parseManualDeliveryVariance(f);
    if ("error" in parsed) return parsed;
    await saveFmcgDeliveryVariance(parsed.data);
    await addLog(`FMCG delivery variance DO ${parsed.data.doNo} (${parsed.data.itemCode}) saved`);
    refreshRoutes("/logistics");
    return { ok: `Saved delivery variance for DO ${parsed.data.doNo}.` };
  }
  if (kind === "consignment") {
    const parsed = parseManualConsignment(f);
    if ("error" in parsed) return parsed;
    await saveFmcgConsignment(parsed.data);
    await addLog(`FMCG consignment ${parsed.data.consignmentNo} line ${parsed.data.lineNo} saved`);
    refreshRoutes("/logistics");
    return { ok: `Saved consignment receipt ${parsed.data.consignmentNo} (line ${parsed.data.lineNo}).` };
  }
  if (kind === "stockExpiry") {
    const parsed = parseManualStockExpiry(f);
    if ("error" in parsed) return parsed;
    await saveFmcgStockExpiry(parsed.data);
    await addLog(`FMCG stock expiry ${parsed.data.report} line ${parsed.data.lineNo} (${parsed.data.asOf}) saved`);
    refreshRoutes("/products");
    return { ok: `Saved stock expiry entry for ${parsed.data.itemCode}.` };
  }
  return { error: "Unknown FMCG record type." };
}

export async function saveManualFinanceCustomerAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const kind = cleanText(f.get("recordKind"), 40);
  if (kind === "receivablesSnapshot") {
    const parsed = parseManualReceivablesSnapshot(f);
    if ("error" in parsed) return parsed;
    const co = await resolveOptionalCompany(parsed.data.companyId);
    if (!co.ok) return { error: "Selected company not found." };
    await saveReceivablesSnapshot({ ...parsed.data, companyId: co.id });
    await addLog(`Receivables snapshot (${co.name ?? "Group"}) as of ${parsed.data.asOf} saved`);
    refreshRoutes("/dashboard", "/finance");
    return { ok: `Saved receivables aging snapshot (${co.name ?? "Group / Unassigned"}).` };
  }
  if (kind === "overdueInvoice") {
    const parsed = parseManualOverdueInvoice(f);
    if ("error" in parsed) return parsed;
    const co = await resolveOptionalCompany(parsed.data.companyId);
    if (!co.ok) return { error: "Selected company not found." };
    await saveOverdueInvoice({ ...parsed.data, companyId: co.id });
    await addLog(`Overdue invoice ${parsed.data.invoiceNo} (${parsed.data.accountName}) saved`);
    refreshRoutes("/dashboard", "/finance");
    return { ok: `Saved overdue invoice ${parsed.data.invoiceNo}.` };
  }
  return { error: "Unknown finance/customer record type." };
}

export async function saveManualHrAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const kind = cleanText(f.get("recordKind"), 40);
  if (kind === "employee") {
    const parsed = parseManualEmployee(f);
    if ("error" in parsed) return parsed;
    await saveManualEmployeeRecord(parsed.data);
    await addLog(`Employee ${parsed.data.id} (${parsed.data.name}) saved manually`);
    refreshRoutes("/dashboard", "/hr", "/admin/employees");
    return { ok: `Saved employee ${parsed.data.name} (${parsed.data.id}).` };
  }
  return { error: "Unknown HR record type." };
}

export async function saveManualLogisticsAction(_: ManualActionState, f: FormData): Promise<ManualActionState> {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  const kind = cleanText(f.get("recordKind"), 40);
  if (kind === "kpis") {
    const parsed = parseManualLogisticsKpis(f);
    if ("error" in parsed) return parsed;
    await saveLogisticsKpis(parsed.data);
    await addLog("Logistics summary KPIs updated");
    refreshRoutes("/logistics");
    return { ok: "Saved logistics KPI summary figures." };
  }
  if (kind === "fleet") {
    const parsed = parseManualFleetVehicle(f);
    if ("error" in parsed) return parsed;
    await saveFleetVehicle(parsed.data);
    await addLog(`Fleet vehicle ${parsed.data.vehicleNo} saved`);
    refreshRoutes("/logistics");
    return { ok: `Saved vehicle ${parsed.data.vehicleNo}.` };
  }
  if (kind === "shipment") {
    const parsed = parseManualShipment(f);
    if ("error" in parsed) return parsed;
    await saveShipment(parsed.data);
    await addLog(`Shipment ${parsed.data.shipmentCode} (${parsed.data.status}) saved`);
    refreshRoutes("/dashboard", "/logistics");
    return { ok: `Saved shipment ${parsed.data.shipmentCode}.` };
  }
  if (kind === "warehouse") {
    const parsed = parseManualWarehouse(f);
    if ("error" in parsed) return parsed;
    await saveWarehouse(parsed.data);
    await addLog(`Warehouse ${parsed.data.name} saved`);
    refreshRoutes("/logistics");
    return { ok: `Saved warehouse ${parsed.data.name}.` };
  }
  if (kind === "customs") {
    const parsed = parseManualCustoms(f);
    if ("error" in parsed) return parsed;
    await saveCustomsClearance(parsed.data);
    await addLog(`Customs clearance B/L ${parsed.data.bolNo} saved`);
    refreshRoutes("/logistics");
    return { ok: `Saved customs clearance ${parsed.data.bolNo}.` };
  }
  return { error: "Unknown logistics record type." };
}

export async function deleteManualRecordAction(f: FormData) {
  await requireAdmin("mutation");
  const kind = cleanText(f.get("deleteKind"), 40);

  if (kind === "companyFigureCell") {
    const companyId = parsePositiveIntId(f.get("companyId"));
    const section = cleanText(f.get("section"), 20);
    const ym = parseYearMonth(f.get("year"), f.get("month"));
    const main = cleanText(f.get("main"), 80);
    const line = cleanText(f.get("line"), 80);
    const unitType = cleanText(f.get("unitType"), 40);
    if (!companyId || !section || !ym || !main || !line) return;
    const branchId = await branchOf(companyId, f.get("branchId"));
    if (branchId === undefined) return;
    await deleteCompanyFigureEntry(companyId, section, ym.year, ym.month, main, line, unitType, branchId);
    await addLog(`Deleted ${section} figure ${main} / ${line} (${MONTHS[ym.month]} ${ym.year})`);
    refreshCompanyReports(companyId);
    return;
  }

  if (kind === "monthlySection") {
    const companyId = parsePositiveIntId(f.get("companyId"));
    const section = cleanText(f.get("section"), 20);
    const ym = parseYearMonth(f.get("year"), f.get("month"));
    if (!companyId || (section !== "sales" && section !== "budget" && section !== "people" && section !== "expenses") || !ym) return;
    const branchId = await branchOf(companyId, f.get("branchId"));
    if (branchId === undefined) return;
    if (section === "sales") {
      await deleteCompanyFigureEntry(companyId, "sales", ym.year, ym.month, "REVENUE", "Sales", "", branchId);
    } else {
      await deleteFigureMonth(companyId, section, ym.year, ym.month, branchId);
    }
    await addLog(`Deleted ${section} month (${MONTHS[ym.month]} ${ym.year})`);
    refreshCompanyReports(companyId);
    return;
  }

  if (kind === "dailyStay") {
    const companyId = parsePositiveIntId(f.get("companyId"));
    const date = parseIsoDate(f.get("date"));
    if (!companyId || !date) return;
    const branchId = await branchOf(companyId, f.get("branchId"));
    if (branchId === undefined) return;
    await deleteDailyStayRow(companyId, date, branchId);
    await addLog(`Deleted daily stay row ${date}`);
    refreshCompanyReports(companyId);
    return;
  }

  if (kind === "unitTypesMonth") {
    const companyId = parsePositiveIntId(f.get("companyId"));
    const ym = parseYearMonth(f.get("year"), f.get("month"));
    const unitType = cleanText(f.get("unitType"), 40);
    if (!companyId || !ym || !unitType) return;
    const branchId = await branchOf(companyId, f.get("branchId"));
    if (branchId === undefined) return;
    await deleteUnitTypesMonth(companyId, ym.year, ym.month, unitType, branchId);
    await addLog(`Deleted unit type ${unitType} (${MONTHS[ym.month]} ${ym.year})`);
    refreshCompanyReports(companyId);
    return;
  }

  if (kind === "dailyReceiptDay") {
    const companyId = parsePositiveIntId(f.get("companyId"));
    const branchId = parsePositiveIntId(f.get("branchId"));
    const date = parseIsoDate(f.get("date"));
    const line = cleanText(f.get("line"), 60) || undefined;
    if (!companyId || !branchId || !date) return;
    if ((await branchOf(companyId, branchId)) !== branchId) return;
    await deleteDailyReceiptEntry(branchId, date, line);
    await addLog(`Deleted daily takings ${date}${line ? ` (${line})` : ""}`);
    refreshCompanyReports(companyId);
    return;
  }

  if (kind === "cogsMonth") {
    const companyId = parsePositiveIntId(f.get("companyId"));
    const ym = parseYearMonth(f.get("year"), f.get("month"));
    if (!companyId || !ym) return;
    const branchId = await branchOf(companyId, f.get("branchId"));
    if (branchId === undefined) return;
    await deleteCogsMonthEntries(companyId, ym.year, ym.month, branchId);
    await addLog(`Deleted COGS month (${MONTHS[ym.month]} ${ym.year})`);
    refreshCompanyReports(companyId);
    return;
  }

  if (kind === "salesTarget") {
    const code = cleanText(f.get("code"), 80);
    const period = parseIsoDate(f.get("period"));
    if (!code || !period) return;
    await deleteSalesDepartmentTarget(code, period);
    await addLog(`Deleted sales target ${code} (${period.slice(0, 7)})`);
    refreshRoutes("/sales", "/finance");
    return;
  }

  if (kind === "salesIndicator") {
    const departmentCode = cleanText(f.get("departmentCode"), 80);
    const period = parseIsoDate(f.get("period"));
    const indicator = cleanText(f.get("indicator"), 40);
    if (!period || !indicator) return;
    await deleteSalesSectorIndicator(departmentCode, period, indicator);
    await addLog(`Deleted sales indicator ${indicator} (${period.slice(0, 7)})`);
    refreshRoutes("/sales");
    return;
  }

  if (kind === "fmcgBrand") {
    const code = cleanText(f.get("code"), 60);
    if (code && !(await deleteFmcgBrand(code))) {
      await addLog(`Deleted FMCG brand ${code}`);
      refreshRoutes("/sales", "/products");
    }
    return;
  }
  if (kind === "fmcgSalesman") {
    const code = cleanText(f.get("code"), 40);
    if (code && !(await deleteFmcgSalesman(code))) {
      await addLog(`Deleted FMCG salesman ${code}`);
      refreshRoutes("/sales", "/hr");
    }
    return;
  }
  if (kind === "fmcgCustomer") {
    const code = cleanText(f.get("code"), 40);
    if (code && !(await deleteFmcgCustomer(code))) {
      await addLog(`Deleted FMCG customer ${code}`);
      refreshRoutes("/customers");
    }
    return;
  }
  if (kind === "fmcgItem") {
    const code = cleanText(f.get("code"), 40);
    if (code && !(await deleteFmcgItem(code))) {
      await addLog(`Deleted FMCG item ${code}`);
      refreshRoutes("/products");
    }
    return;
  }
  if (kind === "fmcgAssignment") {
    const period = parseIsoDate(f.get("period"));
    const salesmanCode = cleanText(f.get("salesmanCode"), 40);
    const brand = cleanText(f.get("brand"), 80);
    if (!period || !salesmanCode || !brand) return;
    await deleteFmcgSalesAssignment(period, salesmanCode, brand);
    await addLog(`Deleted FMCG target ${salesmanCode} / ${brand} (${period.slice(0, 7)})`);
    refreshRoutes("/sales");
    return;
  }
  if (kind === "fmcgManagerTarget") {
    const period = parseIsoDate(f.get("period"));
    const manager = cleanText(f.get("manager"), 120);
    if (!period || !manager) return;
    await deleteFmcgManagerTarget(period, manager);
    await addLog(`Deleted manager target ${manager} (${period.slice(0, 7)})`);
    refreshRoutes("/sales");
    return;
  }
  if (kind === "fmcgStockSnapshot") {
    const asOf = parseIsoDate(f.get("asOf"));
    const itemCode = cleanText(f.get("itemCode"), 40);
    const location = cleanText(f.get("location"), 80);
    if (!asOf || !itemCode || !location) return;
    await deleteFmcgStockSnapshot(asOf, itemCode, location);
    await addLog(`Deleted stock snapshot ${itemCode} @ ${location} (${asOf})`);
    refreshRoutes("/products", "/logistics");
    return;
  }
  if (kind === "fmcgVariance") {
    const doNo = cleanText(f.get("doNo"), 60);
    const itemCode = cleanText(f.get("itemCode"), 40);
    const location = cleanText(f.get("location"), 80);
    if (!doNo || !itemCode || !location) return;
    await deleteFmcgDeliveryVariance(doNo, itemCode, location);
    await addLog(`Deleted delivery variance DO ${doNo} (${itemCode})`);
    refreshRoutes("/logistics");
    return;
  }
  if (kind === "fmcgConsignment") {
    const receivedDate = parseIsoDate(f.get("receivedDate"));
    const lineNo = parsePositiveIntId(f.get("lineNo"));
    if (!receivedDate || !lineNo) return;
    await deleteFmcgConsignment(receivedDate, lineNo);
    await addLog(`Deleted consignment line ${receivedDate} #${lineNo}`);
    refreshRoutes("/logistics");
    return;
  }
  if (kind === "fmcgExpiry") {
    const asOf = parseIsoDate(f.get("asOf"));
    const report = cleanText(f.get("report"), 80);
    const lineNo = parsePositiveIntId(f.get("lineNo"));
    if (!asOf || !report || !lineNo) return;
    await deleteFmcgStockExpiry(asOf, report, lineNo);
    await addLog(`Deleted stock expiry ${report} #${lineNo} (${asOf})`);
    refreshRoutes("/products");
    return;
  }

  const id = parsePositiveIntId(f.get("id"));
  if (kind === "employee") {
    const empId = cleanText(f.get("employeeId"), 40);
    if (!empId) return;
    await deleteEmployeeRecord(empId);
    await addLog(`Deleted employee ${empId}`);
    refreshRoutes("/dashboard", "/hr", "/admin/employees");
    return;
  }
  if (!id) return;

  if (kind === "receivablesSnapshot") {
    await deleteReceivablesSnapshot(id);
    await addLog(`Deleted receivables snapshot #${id}`);
    refreshRoutes("/dashboard", "/finance");
  } else if (kind === "overdueInvoice") {
    await deleteOverdueInvoice(id);
    await addLog(`Deleted overdue invoice #${id}`);
    refreshRoutes("/dashboard", "/finance");
  } else if (kind === "fleetVehicle") {
    await deleteFleetVehicle(id);
    await addLog(`Deleted fleet vehicle #${id}`);
    refreshRoutes("/logistics");
  } else if (kind === "shipment") {
    await deleteShipment(id);
    await addLog(`Deleted shipment #${id}`);
    refreshRoutes("/dashboard", "/logistics");
  } else if (kind === "warehouse") {
    await deleteWarehouse(id);
    await addLog(`Deleted warehouse #${id}`);
    refreshRoutes("/logistics");
  } else if (kind === "customs") {
    await deleteCustomsClearance(id);
    await addLog(`Deleted customs clearance #${id}`);
    refreshRoutes("/logistics");
  }
}

