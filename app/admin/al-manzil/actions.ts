"use server";
import { GuardError, requireAdmin, withUploadSlot } from "@/lib/guard";
import { cleanText, isValidFigureAmount, parsePositiveIntId } from "@/lib/input-validation";
import { SECTOR } from "@/lib/org";
import { inspectWorkbookArchive, sanitizeUploadFileName } from "@/lib/upload-security";
import { revalidatePath, updateTag } from "next/cache";
import { listAccounts } from "@/lib/accounts";
import { branchName, branchOf, listBranches } from "@/lib/branches";
import { getCompany } from "@/lib/companies";
import { parseGrid, sectionName } from "@/lib/company-data";
import { deleteDailyYearRows, deleteFigureYear, importBalances, importCogs, importControl, importDaily, importFigures, importMasters, importReceipts, linesOf, recordRejected, setFigure, type Upload } from "@/lib/company-figures";
import { gridFromWorkbook, MAX_UPLOAD_BYTES, readWorkbook } from "@/lib/company-template";
import { addLog } from "@/lib/db";
import { checkDaily, cogsForCompany, cogsFromWorkbook, dailyFromWorkbook, dukanFromWorkbook, matchAccounts, pnlFromWorkbook, receiptsFromWorkbook, unitsFromWorkbook } from "@/lib/report-parsers";
import { REPORTS_CACHE_TAG } from "@/lib/reports";
import { balancesFromWorkbook } from "@/lib/fmcg-balances";
import { controlFromWorkbook } from "@/lib/fmcg-control";
import { mastersFromWorkbook } from "@/lib/fmcg-masters";
import { MONTHS } from "@/lib/format";
import { cogsFromYear, receiptsFromYear } from "@/lib/server-config";

export type UploadState = { error?: string; ok?: string };
type Company = NonNullable<Awaited<ReturnType<typeof getCompany>>>;

const LABEL: Record<string, string> = { pnl: "P&L", daily: "Daily sales", units: "Unit types", sales: "Monthly sales", receipts: "Daily sales deposit", cogs: "COGS summary", dukan: "Dukan Food monthly sales", masters: "FMCG reference data", balances: "FMCG stock and control reports" };

function refresh() {
  updateTag(REPORTS_CACHE_TAG);
  for (const p of ["/admin/finance", "/admin/data-status", "/admin/activity", "/real-estate", "/real-estate/overview", "/real-estate/details", "/restaurants", "/finance", "/dashboard", "/health-beauty", "/retail"]) revalidatePath(p);
  revalidatePath("/admin", "layout");
}
const monthNames = (rows: { year: number; month: number }[]) => [...new Set(rows.map((r) => `${MONTHS[r.month]} ${r.year}`))].join(", ");

/** Parses and saves one file; returns the success message. Throwing rejects the file: nothing is saved except the record of the attempt. */
async function loadFile(type: string, company: Company, u: Upload, formYear: number) {
  const wb = await readWorkbook(u.buf);
  const loadFromYear = receiptsFromYear();
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
    const { title, rows, issues, rowsRead, controlTotal } = receiptsFromWorkbook(wb, loadFromYear);
    if (!rows.length) throw new Error("No dated rows found - is this the Daily Sales Deposit layout?");
    const branch = (await listBranches(company.id)).find((b) => b.id === u.branchId);
    const name = branch?.name ?? await branchName(u.branchId);
    const known = [name, ...(branch?.aliases ?? [])].map((n) => n.toLowerCase());
    if (!known.some((n) => title.toLowerCase().includes(n))) throw new Error(`This file is headed "${title}", not ${name}. Pick the right branch or file.`);
    await importReceipts({ ...u, branchId: u.branchId }, rows, { rowsRead, controlTotal, issues });
    const days = [...new Set(rows.map((r) => r.date))].sort();
    const review = issues.length ? ` ${issues.length} to check, first: ${issues[0].sheet} row ${issues[0].row}: ${issues[0].reason}` : "";
    return { rows: rows.length, ok: `Loaded ${days.length} days for ${name}, ${days[0]} to ${days.at(-1)}.${review}` };
  }
  if (type === "dukan") {
    if (!u.branchId) throw new Error("Pick the branch in the \"Data for\" row first.");
    const { rows, issues, rowsRead, controlTotal } = dukanFromWorkbook(wb, loadFromYear);
    if (!rows.length) throw new Error(`No figures from ${loadFromYear} onward. Upload DUKAN-TOTAL, not the summary copy with the old dates.`);
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
    if (!b.rowsRead) throw new Error("No stock rows found. Upload the Stock Report workbook (TC outstanding now comes straight from the database).");
    await importBalances(u, b);
    return { rows: b.rowsRead, ok: `Loaded ${b.stock.length} stock rows for ${b.stockDate}.${b.issues.length ? ` ${b.issues.length} to check, first: ${b.issues[0].reason}` : ""}` };
  }
  if (type === "masters") {
    const m = mastersFromWorkbook(wb);
    if (!m.rowsRead) throw new Error("No reference sheets found. Upload the Market Audit, Stock Report or Daily Sales Report workbook.");
    await importMasters(u, m);
    const parts = [[m.salesmen.length, "salesmen"], [m.customers.length, "customers"], [m.items.length, "items"], [m.assignments.length, `targets for ${m.period?.slice(0, 7)}`]].filter(([n]) => n).map(([n, what]) => `${n} ${what}`);
    return { rows: m.rowsRead, ok: `Loaded ${parts.join(", ")}.${m.issues.length ? ` ${m.issues.length} to check, first: ${m.issues[0].reason}` : ""}` };
  }
  if (type === "cogs") {
    const parsed = cogsFromWorkbook(wb, cogsFromYear());
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
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin("upload");
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }

  try {
    return await withUploadSlot(admin.email, async () => {
      const type = cleanText(f.get("type"), 30), companyId = parsePositiveIntId(f.get("companyId")), file = f.get("file");
      if (!(type in LABEL)) return { error: "Unknown report type." };
      if (!companyId) return { error: "Company not found." };
      const company = await getCompany(companyId);
      if (!company) return { error: "Company not found." };
      const branchId = await branchOf(company.id, f.get("branchId"));
      if (branchId === undefined) return { error: "Branch not found." };
      if (!(file instanceof File) || !file.size) return { error: "Choose an .xlsx or .csv file." };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "The file must be under 7 MB." };
      const buf = Buffer.from(await file.arrayBuffer());
      const archiveCheck = inspectWorkbookArchive(buf);
      if (!archiveCheck.ok) return { error: archiveCheck.error };
      const safeName = sanitizeUploadFileName(file.name);
      const u: Upload = { companyId: company.id, section: type, name: safeName, type: archiveCheck.mimeType, buf, branchId, uploadedBy: admin.email };
      try {
        const { rows, ok } = await loadFile(type, company, u, Number(f.get("year")));
        await addLog(`${company.name}: ${LABEL[type]} uploaded (${safeName})`, true, rows);
        refresh();
        return { ok };
      } catch (e) {
        const error = (e as Error).message;
        await recordRejected(u, error);
        await addLog(`${company.name}: ${LABEL[type]} rejected (${safeName})`, false, 0);
        refresh();
        return { error };
      }
    });
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}

const validYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2100;

async function companyFrom(key: string) {
  const id = parsePositiveIntId(key);
  if (!id) return null;
  return (await getCompany(id)) ?? null;
}

async function saveCell(section: string, year: number, key: string, main: string, sub: string, month: number, value: number, unitType = "") {
  if (!validYear(year)) return "Invalid year.";
  if (!Number.isInteger(month) || month < 0 || month > 11) return "Invalid month.";
  if (!isValidFigureAmount(value)) return "Enter a valid amount.";
  const company = await companyFrom(key);
  if (!company) return "Company not found.";
  const refused = await setFigure(company.id, section, year, month, main, sub, unitType, value);
  if (refused) return refused;
  await addLog(`${company.name}: ${LABEL[section]} ${unitType || main} / ${sub} ${MONTHS[month]} ${year} set to ${value}`);
  refresh();
}

/** Save one edited figure: year + key bind first so the client component gets a plain (main, sub, month, value) action. */
export async function savePnlCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return e.message;
    throw e;
  }
  const safeMain = cleanText(main, 80), safeSub = cleanText(sub, 80);
  if (!(await listAccounts()).some((a) => a.main === safeMain && a.sub === safeSub)) return "Unknown account.";
  return saveCell("pnl", year, key, safeMain, safeSub, month, value);
}

/** One edited monthly sales figure, for companies with no daily report. A hotel's monthly sales are calculated from its daily rows. */
export async function saveSalesCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return e.message;
    throw e;
  }
  const safeMain = cleanText(main, 80), safeSub = cleanText(sub, 80);
  if ((await linesOf("sales")).get(safeSub) !== safeMain) return "Unknown sales line.";
  return saveCell("sales", year, key, safeMain, safeSub, month, value);
}

/** One edited unit-type figure. In the grid the unit type shows as the group, so "main" here is the unit type. */
export async function saveUnitsCell(year: number, key: string, main: string, sub: string, month: number, value: number) {
  try {
    await requireAdmin("mutation");
  } catch (e) {
    if (e instanceof GuardError) return e.message;
    throw e;
  }
  const safeSub = cleanText(sub, 80);
  const group = (await linesOf("units")).get(safeSub);
  const unitType = cleanText(main, 40);
  if (!group || !unitType) return "Unknown unit line.";
  return saveCell("units", year, key, group, safeSub, month, value, unitType);
}

/** Delete one year's P&L statement for a company. */
export async function deletePnlYear(f: FormData) {
  await requireAdmin("mutation");
  const year = Number(f.get("year"));
  if (!validYear(year)) return;
  const company = await companyFrom(cleanText(f.get("key"), 20));
  if (!company) return;
  await deleteFigureYear(company.id, "pnl", year);
  await addLog(`${company.name}: P&L ${year} deleted`);
  refresh();
}

/** Delete one year of a company's monthly sales: its daily rows and any monthly sales figures. */
export async function deleteDailyYear(f: FormData) {
  await requireAdmin("mutation");
  const year = Number(f.get("year"));
  if (!validYear(year)) return;
  const company = await companyFrom(cleanText(f.get("key"), 20));
  if (!company) return;
  await deleteDailyYearRows(company.id, year);
  await deleteFigureYear(company.id, "sales", year);
  await addLog(`${company.name}: monthly sales ${year} deleted`);
  refresh();
}
