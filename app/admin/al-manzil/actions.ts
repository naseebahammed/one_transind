"use server";
import { SECTOR } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { listAccounts } from "@/lib/accounts";
import { branchName, branchOf, listBranches } from "@/lib/branches";
import { getCompany } from "@/lib/companies";
import { parseGrid, sectionName } from "@/lib/company-data";
import { deleteDailyYearRows, deleteFigureYear, importBalances, importCogs, importControl, importDaily, importFigures, importMasters, importReceipts, linesOf, recordRejected, setFigure, type Upload } from "@/lib/company-figures";
import { gridFromWorkbook, MAX_UPLOAD_BYTES, readWorkbook } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { checkDaily, cogsForCompany, cogsFromWorkbook, dailyFromWorkbook, dukanFromWorkbook, matchAccounts, pnlFromWorkbook, receiptsFromWorkbook, unitsFromWorkbook } from "@/lib/report-parsers";
import { balancesFromWorkbook } from "@/lib/fmcg-balances";
import { controlFromWorkbook } from "@/lib/fmcg-control";
import { mastersFromWorkbook } from "@/lib/fmcg-masters";
import { MONTHS } from "@/lib/format";

export type UploadState = { error?: string; ok?: string };
type Company = NonNullable<Awaited<ReturnType<typeof getCompany>>>;

const LABEL: Record<string, string> = { pnl: "P&L", daily: "Daily sales", units: "Unit types", sales: "Monthly sales", receipts: "Daily sales deposit", cogs: "COGS summary", dukan: "Dukan Food monthly sales", masters: "FMCG reference data", balances: "FMCG stock and control reports" };

function refresh() {
  for (const p of ["/admin/finance", "/admin/data-status", "/admin/activity", "/real-estate", "/real-estate/overview", "/real-estate/details", "/restaurants", "/finance", "/dashboard", "/health-beauty", "/retail"]) revalidatePath(p);
  revalidatePath("/admin", "layout");
}
const monthNames = (rows: { year: number; month: number }[]) => [...new Set(rows.map((r) => `${MONTHS[r.month]} ${r.year}`))].join(", ");

/** shortcut: restaurant sheets from before this year are skipped, as agreed for the first load; lower it to bring in older history. */
const LOAD_FROM_YEAR = 2026;

/** A branch whose workbook is headed with a different name than the branch (lower-case branch name -> names its sheet may carry). shortcut: hard-coded, move to a branch column if more appear. */
const OTHER_SHEET_NAMES: Record<string, string[]> = { "qatar sports club": ["Westbay"] };

/** Parses and saves one file; returns the success message. Throwing rejects the file: nothing is saved except the record of the attempt. */
async function loadFile(type: string, company: Company, u: Upload, formYear: number) {
  const wb = await readWorkbook(u.buf);
  if (type === "pnl") {
    const parsed = pnlFromWorkbook(wb, formYear);
    if ("error" in parsed) throw new Error(parsed.error);
    const matched = matchAccounts(parsed.rows, await listAccounts());
    if ("error" in matched) throw new Error(matched.error);
    await importFigures(u, matched.rows);
    return { rows: matched.rows.length, ok: `Loaded ${matched.rows.length} figure${matched.rows.length > 1 ? "s" : ""} for ${monthNames(matched.rows)}.` };
  }
  if (type === "receipts") {
    if (!u.branchId) throw new Error("Pick the branch in the \"Data for\" row first.");
    const { title, rows, issues, rowsRead, controlTotal } = receiptsFromWorkbook(wb, LOAD_FROM_YEAR);
    if (!rows.length) throw new Error("No dated rows found - is this the Daily Sales Deposit layout?");
    const branch = (await listBranches(company.id)).find((b) => b.id === u.branchId);
    const name = branch?.name ?? await branchName(u.branchId);
    const known = [name, ...(branch?.aliases ?? []), ...(OTHER_SHEET_NAMES[name.toLowerCase()] ?? [])].map((n) => n.toLowerCase());
    if (!known.some((n) => title.toLowerCase().includes(n))) throw new Error(`This file is headed "${title}", not ${name}. Pick the right branch or file.`);
    await importReceipts({ ...u, branchId: u.branchId }, rows, { rowsRead, controlTotal, issues });
    const days = [...new Set(rows.map((r) => r.date))].sort();
    const review = issues.length ? ` ${issues.length} to check, first: ${issues[0].sheet} row ${issues[0].row}: ${issues[0].reason}` : "";
    return { rows: rows.length, ok: `Loaded ${days.length} days for ${name}, ${days[0]} to ${days.at(-1)}.${review}` };
  }
  if (type === "dukan") {
    if (!u.branchId) throw new Error("Pick the branch in the \"Data for\" row first.");
    const { rows, issues, rowsRead, controlTotal } = dukanFromWorkbook(wb, LOAD_FROM_YEAR);
    if (!rows.length) throw new Error(`No figures from ${LOAD_FROM_YEAR} onward. Upload DUKAN-TOTAL, not the summary copy with the old dates.`);
    await importReceipts({ ...u, section: "receipts", branchId: u.branchId }, rows, { rowsRead, controlTotal, issues });
    const days = [...new Set(rows.map((r) => r.date))].sort();
    const review = issues.length ? ` ${issues.length} to check, first: ${issues[0].sheet} row ${issues[0].row}: ${issues[0].reason}` : "";
    return { rows: rows.length, ok: `Loaded ${days.length} days, ${days[0]} to ${days.at(-1)}.${review}` };
  }
  if (type === "balances") {
    const control = controlFromWorkbook(wb);
    if (control.rowsRead) {
      await importControl(u, control);
      const what = [control.variances.length && `${control.variances.length} delivery variances`, control.consignments.length && `${control.consignments.length} consignment lines`, control.expiry.length && `${control.expiry.length} expiry rows for ${control.expiryReport}, ${control.expiryDate}`].filter(Boolean).join(", ");
      return { rows: control.rowsRead, ok: `Loaded ${what}.${control.issues.length ? ` ${control.issues.length} to check, first: ${control.issues[0].reason}` : ""}` };
    }
    const b = balancesFromWorkbook(wb, u.name);
    if (!b.rowsRead) throw new Error("No stock or outstanding rows found. Upload the Stock Report or TC Outstanding workbook.");
    await importBalances(u, b);
    const parts = [b.stock.length ? `${b.stock.length} stock rows for ${b.stockDate}` : "", b.outstanding.length ? `${b.outstanding.length} outstanding invoices as of ${b.outstandingDate}` : ""].filter(Boolean);
    return { rows: b.rowsRead, ok: `Loaded ${parts.join(", ")}.${b.issues.length ? ` ${b.issues.length} to check, first: ${b.issues[0].reason}` : ""}` };
  }
  if (type === "masters") {
    const m = mastersFromWorkbook(wb);
    if (!m.rowsRead) throw new Error("No reference sheets found. Upload the Market Audit, Stock Report or Daily Sales Report workbook.");
    await importMasters(u, m);
    const parts = [[m.salesmen.length, "salesmen"], [m.customers.length, "customers"], [m.items.length, "items"], [m.assignments.length, `targets for ${m.period?.slice(0, 7)}`]].filter(([n]) => n).map(([n, what]) => `${n} ${what}`);
    return { rows: m.rowsRead, ok: `Loaded ${parts.join(", ")}.${m.issues.length ? ` ${m.issues.length} to check, first: ${m.issues[0].reason}` : ""}` };
  }
  if (type === "cogs") {
    const parsed = cogsFromWorkbook(wb, LOAD_FROM_YEAR);
    const { rows, issues } = cogsForCompany(parsed.rows, company.name, await listBranches(company.id), company.aliases);
    if (!rows.length) throw new Error(`This file has no COGS columns for ${company.name}.`);
    await importCogs(u, rows, [...parsed.issues, ...issues]);
    const heldBack = issues.length ? ` ${issues.map((x) => x.reason).join(" ")}` : "";
    return { rows: rows.length, ok: `Loaded ${rows.length} COGS figures for ${monthNames(rows)}.${heldBack}` };
  }
  if (type === "daily") {
    const rows = dailyFromWorkbook(wb);
    if (!rows.length) throw new Error("No dated rows found - is this the monthly sales report layout?");
    const bad = checkDaily(rows, company.total_rooms);
    if (bad) throw new Error(bad);
    await importDaily(u, rows);
    return { rows: rows.length, ok: `Loaded ${rows.length} daily rows.` };
  }
  if (type === "units") {
    const rows = unitsFromWorkbook(wb);
    if (!rows.length) throw new Error("No unit-type rows found - is this the 1 BHK / 2 BHK sales report layout?");
    await importFigures(u, rows.map((r) => ({ ...r, main: "UNITS" })));
    return { rows: rows.length, ok: `Loaded ${rows.length} unit-type figures for ${monthNames(rows)}.` };
  }
  // Monthly sales template for companies with no stay report (Pavati, Top Perfume). A hotel's grid already has revenue lines, so a Sales line would double count.
  if (company.sector === SECTOR.realEstate) throw new Error("Real estate sales come from the daily report.");
  const grid = gridFromWorkbook(wb);
  const year = Number(String(grid[0]?.[0] ?? "").match(/(\d{4})\s*$/)?.[1]);
  if (!year) throw new Error(`This file is not a ${sectionName("sales")} template. Download one and try again.`);
  const parsed = parseGrid("sales", grid, { company: company.name, year }, new Date());
  if ("error" in parsed) throw new Error(parsed.error);
  await importFigures(u, parsed.figures.map((x) => ({ ...x, main: "REVENUE" })));
  return { rows: parsed.figures.length, ok: `Saved ${parsed.figures.length} month${parsed.figures.length > 1 ? "s" : ""} for ${year}: ${parsed.figures.map((x) => MONTHS[x.month]).join(", ")}.` };
}

/** One upload form for every report type: "pnl" (monthly P&L workbook), "daily" (daily sales report), "units" (per unit-type sales) or "sales" (monthly sales template), as .xlsx or .csv. */
export async function uploadReport(_: UploadState, f: FormData): Promise<UploadState> {
  const type = String(f.get("type")), file = f.get("file");
  if (!(type in LABEL)) return { error: "Unknown report type." };
  const company = await getCompany(Number(f.get("companyId")));
  if (!company) return { error: "Company not found." };
  const branchId = await branchOf(company.id, f.get("branchId"));
  if (branchId === undefined) return { error: "Branch not found." };
  if (!(file instanceof File) || !file.size) return { error: "Choose an .xlsx or .csv file." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
  const u: Upload = { companyId: company.id, section: type, name: file.name, type: file.type, buf: Buffer.from(await file.arrayBuffer()), branchId };
  try {
    const { rows, ok } = await loadFile(type, company, u, Number(f.get("year")));
    await addLog(`${company.name}: ${LABEL[type]} uploaded (${file.name})`, true, rows);
    refresh();
    return { ok };
  } catch (e) {
    const error = (e as Error).message;
    await recordRejected(u, error);
    await addLog(`${company.name}: ${LABEL[type]} rejected (${file.name})`, false, 0);
    refresh();
    return { error };
  }
}

async function companyFrom(key: string) {
  const company = await getCompany(Number(key));
  if (!company) throw new Error("Company not found.");
  return company;
}

async function saveCell(section: string, year: number, key: string, main: string, sub: string, month: number, value: number, unitType = "") {
  const company = await companyFrom(key);
  await setFigure(company.id, section, year, month, main, sub, unitType, value);
  await addLog(`${company.name}: ${LABEL[section]} ${unitType || main} / ${sub} ${MONTHS[month]} ${year} set to ${value}`);
  refresh();
}

/** Save one edited figure: year + key bind first so the client component gets a plain (main, sub, month, value) action. */
export async function savePnlCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  await saveCell("pnl", year, key, main, sub, month, value);
}

/** One edited monthly sales figure, for companies with no daily report. A hotel's monthly sales are calculated from its daily rows. */
export async function saveSalesCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  await saveCell("sales", year, key, main, sub, month, value);
}

/** One edited unit-type figure. In the grid the unit type shows as the group, so "main" here is the unit type. */
export async function saveUnitsCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  await saveCell("units", year, key, (await linesOf("units")).get(sub) ?? "UNITS", sub, month, value, main);
}

/** Delete one year's P&L statement for a company. */
export async function deletePnlYear(f: FormData) {
  const company = await companyFrom(String(f.get("key"))), year = Number(f.get("year"));
  await deleteFigureYear(company.id, "pnl", year);
  await addLog(`${company.name}: P&L ${year} deleted`);
  refresh();
}

/** Delete one year of a company's monthly sales: its daily rows and any monthly sales figures. */
export async function deleteDailyYear(f: FormData) {
  const company = await companyFrom(String(f.get("key"))), year = Number(f.get("year"));
  await deleteDailyYearRows(company.id, year);
  await deleteFigureYear(company.id, "sales", year);
  await addLog(`${company.name}: monthly sales ${year} deleted`);
  refresh();
}
