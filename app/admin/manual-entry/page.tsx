import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  ManualCogsForm,
  ManualCustomerOpportunityForm,
  ManualCustomsForm,
  ManualDailyStayForm,
  ManualDailyTakingsForm,
  ManualEmployeeForm,
  ManualExpiringDocumentForm,
  ManualFleetVehicleForm,
  ManualFmcgForms,
  ManualLeaveRequestForm,
  ManualLogisticsKpisForm,
  ManualMonthlySectionForm,
  ManualOverdueInvoiceForm,
  ManualPnlForm,
  ManualReceivablesForm,
  ManualSalesIndicatorsForm,
  ManualSalesTargetForm,
  ManualShipmentForm,
  ManualUnitTypesForm,
  ManualWarehouseForm,
} from "@/components/admin/ManualEntryForms";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listAccounts } from "@/lib/accounts";
import { branchOf, listBranches } from "@/lib/branches";
import { listCompanies, type Company } from "@/lib/companies";
import { LINES, MONTHS, type GridSection } from "@/lib/company-data";
import { listFigures, listReceipts } from "@/lib/company-figures";
import { listEmployees, listSourceNames } from "@/lib/employee-records";
import { fmt } from "@/lib/format";
import { parsePositiveIntId } from "@/lib/input-validation";
import { isManualTab, MANUAL_TABS, SALES_INDICATORS, type ManualTab } from "@/lib/manual-entry-input";
import {
  getLogisticsOverview,
  listCompanySectionYear,
  listCustomerOpportunities,
  listDailyStayMonth,
  listFmcgManualOverview,
  listHrExpiringDocuments,
  listHrLeaveRequests,
  listOverdueInvoices,
  listReceivablesSnapshots,
} from "@/lib/manual-report-records";
import { SECTOR } from "@/lib/org";
import { getSalesSectors, listOverrides } from "@/lib/sales-sectors";
import { listSalesDepartmentTargets, listSalesSectorIndicators } from "@/lib/sales-targets";
import { link } from "@/lib/url";
import { deleteManualRecordAction } from "./actions";

type Search = Promise<{
  tab?: string;
  company?: string;
  branch?: string;
  year?: string;
  month?: string;
}>;

export default function ManualEntryPage({ searchParams }: { searchParams: Search }) {
  return (
    <Page
      title="Manual data entry"
      description="Add or update missing figures across every report and dashboard section without uploading spreadsheets."
    >
      <Content searchParams={searchParams} />
    </Page>
  );
}

function DeleteIconForm({ message, label, fields }: { message: string; label: string; fields: Record<string, string | number> }) {
  return (
    <form action={deleteManualRecordAction} className="inline-flex">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <ConfirmButton
        size="icon-sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        aria-label={label}
        title={label}
        message={message}
      >
        <Trash2 />
      </ConfirmButton>
    </form>
  );
}

const filterCompaniesForTab = (all: Company[], tab: ManualTab) => {
  if (tab === "real-estate") {
    const matches = all.filter((c) => c.sector === SECTOR.realEstate);
    return matches.length ? matches : all;
  }
  if (tab === "restaurants-retail") {
    const matches = all.filter((c) => c.sector === SECTOR.foodBeverage || c.sector === SECTOR.retail);
    return matches.length ? matches : all;
  }
  return all;
};

async function Content({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const tab: ManualTab = params.tab && isManualTab(params.tab) ? params.tab : "pnl";
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const thisYear = today.getFullYear();
  const years = [thisYear - 3, thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  const rawYear = Number(params.year);
  const year = years.includes(rawYear) ? rawYear : thisYear;
  const rawMonth = params.month !== undefined ? Number(params.month) : today.getMonth();
  const month = Number.isInteger(rawMonth) && rawMonth >= 0 && rawMonth <= 11 ? rawMonth : today.getMonth();
  const periodIso = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const defaultMonthDay =
    year === today.getFullYear() && month === today.getMonth()
      ? todayIso
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const allCompanies = await listCompanies();
  const scopedCompanies = filterCompaniesForTab(allCompanies, tab);
  const requestedCompanyId = parsePositiveIntId(params.company);
  const selectedCompany = scopedCompanies.find((c) => c.id === requestedCompanyId) ?? scopedCompanies[0] ?? null;
  const branches = selectedCompany ? await listBranches(selectedCompany.id) : [];
  const verifiedBranch = selectedCompany ? await branchOf(selectedCompany.id, params.branch) : null;
  const branchId = verifiedBranch ?? null;

  const needsCompanyBar = tab === "pnl" || tab === "monthly" || tab === "real-estate" || tab === "restaurants-retail";
  const needsPeriodBar = needsCompanyBar || tab === "sales-fmcg";

  const makeUrl = (patch: Record<string, string | undefined>) =>
    link("/admin/manual-entry", {
      tab,
      company: selectedCompany ? String(selectedCompany.id) : undefined,
      branch: branchId ? String(branchId) : undefined,
      year: String(year),
      month: String(month),
      ...patch,
    });

  return (
    <div className="grid gap-4">
      <Card className="gap-3 px-5 py-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Report categories">
          {MANUAL_TABS.map(([key, label]) => (
            <Button key={key} asChild size="sm" variant={tab === key ? "secondary" : "outline"}>
              <Link href={makeUrl({ tab: key })} role="tab" aria-selected={tab === key}>{label}</Link>
            </Button>
          ))}
        </div>

        {needsPeriodBar && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
            {needsCompanyBar && scopedCompanies.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Company:</span>
                {scopedCompanies.map((c) => (
                  <Button
                    key={c.id}
                    asChild
                    size="sm"
                    variant={selectedCompany?.id === c.id ? "secondary" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                  >
                    <Link href={makeUrl({ company: String(c.id), branch: undefined })}>{c.name}</Link>
                  </Button>
                ))}
              </div>
            )}

            {needsCompanyBar && selectedCompany && branches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Scope:</span>
                <Button asChild size="sm" variant={branchId === null ? "secondary" : "ghost"} className="h-7 px-2.5 text-xs">
                  <Link href={makeUrl({ branch: undefined })}>Whole company</Link>
                </Button>
                {branches.map((b) => (
                  <Button
                    key={b.id}
                    asChild
                    size="sm"
                    variant={branchId === b.id ? "secondary" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                  >
                    <Link href={makeUrl({ branch: String(b.id) })}>{b.name}</Link>
                  </Button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Year:</span>
              {years.map((y) => (
                <Button key={y} asChild size="sm" variant={year === y ? "secondary" : "ghost"} className="h-7 px-2 text-xs">
                  <Link href={makeUrl({ year: String(y) })}>{y}</Link>
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">Month:</span>
              {MONTHS.map((m, i) => (
                <Button key={m} asChild size="sm" variant={month === i ? "secondary" : "ghost"} className="h-7 px-2 text-xs">
                  <Link href={makeUrl({ month: String(i) })}>{m}</Link>
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {tab === "pnl" && (
        <PnlTab company={selectedCompany} branchId={branchId} year={year} month={month} years={years} />
      )}
      {tab === "monthly" && (
        <MonthlyTab company={selectedCompany} branchId={branchId} year={year} month={month} years={years} />
      )}
      {tab === "real-estate" && (
        <RealEstateTab
          company={selectedCompany}
          branchId={branchId}
          year={year}
          month={month}
          years={years}
          defaultDate={defaultMonthDay}
        />
      )}
      {tab === "restaurants-retail" && (
        <RestaurantsRetailTab
          company={selectedCompany}
          branches={branches}
          branchId={branchId}
          year={year}
          month={month}
          years={years}
          defaultDate={defaultMonthDay}
        />
      )}
      {tab === "sales-fmcg" && (
        <SalesFmcgTab year={year} month={month} years={years} periodIso={periodIso} defaultDate={todayIso} />
      )}
      {tab === "finance-customers" && (
        <FinanceCustomersTab companies={allCompanies} defaultDate={todayIso} />
      )}
      {tab === "hr" && (
        <HrTab companies={allCompanies} defaultDate={todayIso} />
      )}
      {tab === "logistics" && <LogisticsTab />}
    </div>
  );
}

async function PnlTab({
  company,
  branchId,
  year,
  month,
  years,
}: {
  company: Company | null;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
}) {
  if (!company) {
    return <Card className="p-6 text-sm text-muted-foreground">Create a company under Admin → Companies first.</Card>;
  }
  const [accounts, rows] = await Promise.all([
    listAccounts(),
    listCompanySectionYear(company.id, "pnl", year, branchId),
  ]);
  const monthRows = rows.filter((r) => r.month === month);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add or update P&amp;L account figure — {company.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualPnlForm
            companyId={company.id}
            branchId={branchId}
            year={year}
            month={month}
            years={years}
            accounts={accounts.map((a) => ({ main: a.main, sub: a.sub, normal_sign: a.normal_sign }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Saved P&amp;L figures for {MONTHS[month]} {year} ({monthRows.length} line{monthRows.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Main account</TableHead>
                <TableHead>Sub account</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Value (QAR)</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthRows.map((r) => (
                <TableRow key={`${r.main}|${r.line}`}>
                  <TableCell className="font-medium">{r.main}</TableCell>
                  <TableCell>{r.line}</TableCell>
                  <TableCell>
                    <Badge variant={r.isManual ? "secondary" : "neutral"}>{r.isManual ? "Manual" : "Uploaded"}</Badge>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${r.value < 0 ? "text-destructive" : ""}`}>
                    {fmt(r.value, 2, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${r.line}`}
                      message={`Remove ${r.main} · ${r.line} for ${MONTHS[month]} ${year}?`}
                      fields={{
                        deleteKind: "companyFigureCell",
                        companyId: company.id,
                        branchId: branchId ?? "",
                        section: "pnl",
                        year,
                        month,
                        main: r.main,
                        line: r.line,
                        unitType: "",
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!monthRows.length && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No P&amp;L lines recorded for {MONTHS[month]} {year} yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function MonthlyTab({
  company,
  branchId,
  year,
  month,
  years,
}: {
  company: Company | null;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
}) {
  if (!company) {
    return <Card className="p-6 text-sm text-muted-foreground">Create a company under Admin → Companies first.</Card>;
  }
  const [salesRows, budgetFigures, peopleFigures, expenseFigures] = await Promise.all([
    listCompanySectionYear(company.id, "sales", year, branchId),
    listFigures(company.id, "budget", year, branchId),
    listFigures(company.id, "people", year, branchId),
    listFigures(company.id, "expenses", year, branchId),
  ]);

  const toMonthMap = (items: { month: number; line: string; value: number }[]) =>
    Object.fromEntries(items.filter((x) => x.month === month).map((x) => [x.line, x.value]));

  const sections: { key: GridSection; title: string; hint: string; allRows: { month: number; line: string; value: number }[] }[] = [
    {
      key: "sales",
      title: "Monthly sales",
      hint: "For companies without daily stay or daily takings workbooks (e.g. Health & Beauty or Retail monthly sales).",
      allRows: salesRows,
    },
    {
      key: "budget",
      title: "Budget",
      hint: "Monthly revenue, direct cost, and overhead targets in QAR (enter as positive amounts; future months allowed).",
      allRows: budgetFigures,
    },
    {
      key: "people",
      title: "People & payroll",
      hint: "Headcount, payroll cost (QAR), joiners, and leavers for the month.",
      allRows: peopleFigures,
    },
    {
      key: "expenses",
      title: "Total expenses",
      hint: "Monthly company operating expenses in QAR.",
      allRows: expenseFigures,
    },
  ];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Enter monthly sections — {company.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sections.map((s) =>
            s.key === "sales" && company.sector === SECTOR.realEstate ? (
              <div key={s.key} className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
                <b>Monthly sales:</b> {company.name} is in Real Estate, so monthly sales are derived automatically from the{" "}
                <Link href={link("/admin/manual-entry", { tab: "real-estate", company: String(company.id), year: String(year), month: String(month) })} className="underline">
                  Real estate Daily Stay
                </Link>{" "}
                tab.
              </div>
            ) : (
              <ManualMonthlySectionForm
                key={s.key}
                section={s.key}
                title={s.title}
                hint={s.hint}
                companyId={company.id}
                branchId={branchId}
                year={year}
                month={month}
                years={years}
                currentValues={toMonthMap(s.allRows)}
              />
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{year} monthly overview — {company.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section / line</TableHead>
                {MONTHS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.flatMap((s) =>
                LINES[s.key].map((line) => (
                  <TableRow key={`${s.key}-${line}`}>
                    <TableCell className="font-medium">
                      <span className="text-xs text-muted-foreground">{s.title} · </span>
                      {line}
                    </TableCell>
                    {MONTHS.map((m, mi) => {
                      const cell = s.allRows.find((r) => r.month === mi && r.line === line);
                      return (
                        <TableCell key={m} className="text-right tabular-nums text-xs">
                          {cell !== undefined ? fmt(cell.value, 2, 0) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Clear {MONTHS[month]} {year} section:</span>
            {sections.map((s) => {
              const hasMonth = s.allRows.some((r) => r.month === month);
              if (!hasMonth) return null;
              return (
                <form key={s.key} action={deleteManualRecordAction}>
                  <input type="hidden" name="deleteKind" value="monthlySection" />
                  <input type="hidden" name="companyId" value={company.id} />
                  <input type="hidden" name="branchId" value={branchId ?? ""} />
                  <input type="hidden" name="section" value={s.key} />
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  <ConfirmButton
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    message={`Clear ${s.title} for ${MONTHS[month]} ${year}?`}
                  >
                    Clear {s.title} ({MONTHS[month]})
                  </ConfirmButton>
                </form>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function RealEstateTab({
  company,
  branchId,
  year,
  month,
  years,
  defaultDate,
}: {
  company: Company | null;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
  defaultDate: string;
}) {
  if (!company) {
    return <Card className="p-6 text-sm text-muted-foreground">Create a company under Admin → Companies first.</Card>;
  }
  const [stayRows, unitRows] = await Promise.all([
    listDailyStayMonth(company.id, year, month, branchId),
    listCompanySectionYear(company.id, "units", year, branchId),
  ]);
  const unitMonthRows = unitRows.filter((r) => r.month === month);
  const unitGroups = [...new Set(unitMonthRows.map((r) => r.unitType))];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daily stay report — {company.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualDailyStayForm
            companyId={company.id}
            branchId={branchId}
            defaultDate={defaultDate}
            totalRooms={company.total_rooms}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Saved daily stay rows — {MONTHS[month]} {year} ({stayRows.length} day{stayRows.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Long guests</TableHead>
                <TableHead className="text-right">Short guests</TableHead>
                <TableHead className="text-right">Occupied / Avail</TableHead>
                <TableHead className="text-right">Occ %</TableHead>
                <TableHead className="text-right">Room rev (QAR)</TableHead>
                <TableHead className="text-right">Other rev (QAR)</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stayRows.map((r) => (
                <TableRow key={r.date}>
                  <TableCell className="font-mono text-xs">{r.date}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.long_guests, 2, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.short_guests, 2, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(r.rooms_occupied, 2, 0)} / {fmt(r.rooms_available, 2, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.rooms_available > 0 ? `${fmt((r.rooms_occupied / r.rooms_available) * 100, 1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.room_revenue, 2, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.other_revenue, 2, 0)}</TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${r.date}`}
                      message={`Delete daily stay row for ${r.date}?`}
                      fields={{ deleteKind: "dailyStay", companyId: company.id, branchId: branchId ?? "", date: r.date }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!stayRows.length && (
                <TableRow>
                  <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                    No daily stay rows recorded for {MONTHS[month]} {year}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Monthly unit-type breakdown (1 BHK, 2 BHK, …) — {company.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualUnitTypesForm
            companyId={company.id}
            branchId={branchId}
            year={year}
            month={month}
            years={years}
            suggestedUnitTypes={company.room_types.map((rt) => rt.type).filter(Boolean)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit type</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Long stay</TableHead>
                <TableHead className="text-right">Short stay</TableHead>
                <TableHead className="text-right">Room revenue (QAR)</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitGroups.map((ut) => {
                const val = (line: string) => unitMonthRows.find((x) => x.unitType === ut && x.line === line)?.value;
                return (
                  <TableRow key={ut}>
                    <TableCell className="font-medium">{ut}</TableCell>
                    <TableCell className="text-right tabular-nums">{val("Available") !== undefined ? fmt(val("Available")!, 2, 0) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{val("Long stay") !== undefined ? fmt(val("Long stay")!, 2, 0) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{val("Short stay") !== undefined ? fmt(val("Short stay")!, 2, 0) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{val("Room revenue") !== undefined ? fmt(val("Room revenue")!, 2, 0) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <DeleteIconForm
                        label={`Delete ${ut}`}
                        message={`Delete ${ut} figures for ${MONTHS[month]} ${year}?`}
                        fields={{
                          deleteKind: "unitTypesMonth",
                          companyId: company.id,
                          branchId: branchId ?? "",
                          year,
                          month,
                          unitType: ut,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!unitGroups.length && (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    No unit-type figures recorded for {MONTHS[month]} {year}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function RestaurantsRetailTab({
  company,
  branches,
  branchId,
  year,
  month,
  years,
  defaultDate,
}: {
  company: Company | null;
  branches: { id: number; name: string }[];
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
  defaultDate: string;
}) {
  if (!company) {
    return <Card className="p-6 text-sm text-muted-foreground">Create a company under Admin → Companies first.</Card>;
  }
  const activeTakingsBranchId = branchId ?? branches[0]?.id ?? null;
  const [receipts, cogsRows] = await Promise.all([
    activeTakingsBranchId ? listReceipts(activeTakingsBranchId, year, month) : Promise.resolve([]),
    listCompanySectionYear(company.id, "cogs", year, branchId),
  ]);
  const cogsMonth = cogsRows.filter((r) => r.month === month);
  const receiptDays = [...new Set(receipts.map((r) => r.date))].sort();
  const activeBranchName = branches.find((b) => b.id === activeTakingsBranchId)?.name ?? "";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daily takings &amp; deposits by payment channel — {company.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualDailyTakingsForm
            companyId={company.id}
            branches={branches}
            defaultBranchId={activeTakingsBranchId}
            defaultDate={defaultDate}
          />
          {activeTakingsBranchId && (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Saved takings for {activeBranchName} — {MONTHS[month]} {year} ({receiptDays.length} day{receiptDays.length === 1 ? "" : "s"})
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Channels recorded</TableHead>
                    <TableHead className="text-right">Gross sales (QAR)</TableHead>
                    <TableHead className="text-right">Bank deposit (QAR)</TableHead>
                    <TableHead className="w-12 text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptDays.map((d) => {
                    const dayItems = receipts.filter((r) => r.date === d);
                    const isBank = (l: string) => /^bank\s+deposits?$/i.test(l.trim());
                    const gross = dayItems.filter((r) => !isBank(r.line)).reduce((s, r) => s + r.value, 0);
                    const bank = dayItems.filter((r) => isBank(r.line)).reduce((s, r) => s + r.value, 0);
                    return (
                      <TableRow key={d}>
                        <TableCell className="font-mono text-xs">{d}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {dayItems.map((r) => `${r.line}: ${fmt(r.value, 2, 0)}`).join(" · ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(gross, 2, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{bank ? fmt(bank, 2, 0) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <DeleteIconForm
                            label={`Delete ${d}`}
                            message={`Delete all takings channels for ${activeBranchName} on ${d}?`}
                            fields={{
                              deleteKind: "dailyReceiptDay",
                              companyId: company.id,
                              branchId: activeTakingsBranchId,
                              date: d,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!receiptDays.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                        No daily takings recorded for {activeBranchName} in {MONTHS[month]} {year}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Monthly restaurant COGS summary — {company.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualCogsForm companyId={company.id} branchId={branchId} year={year} month={month} years={years} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>COGS line ({MONTHS[month]} {year})</TableHead>
                <TableHead className="text-right">Amount (QAR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cogsMonth.map((r) => (
                <TableRow key={r.line}>
                  <TableCell className="font-medium">{r.line}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.value < 0 ? "text-destructive" : ""}`}>
                    {fmt(r.value, 2, 0)}
                  </TableCell>
                </TableRow>
              ))}
              {!cogsMonth.length && (
                <TableRow>
                  <TableCell colSpan={2} className="h-16 text-center text-muted-foreground">
                    No COGS figures recorded for {MONTHS[month]} {year}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {cogsMonth.length > 0 && (
            <form action={deleteManualRecordAction}>
              <input type="hidden" name="deleteKind" value="cogsMonth" />
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="branchId" value={branchId ?? ""} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              <ConfirmButton
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                message={`Delete all COGS figures for ${MONTHS[month]} ${year}?`}
              >
                Delete {MONTHS[month]} {year} COGS
              </ConfirmButton>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function SalesFmcgTab({
  year,
  month,
  years,
  periodIso,
  defaultDate,
}: {
  year: number;
  month: number;
  years: number[];
  periodIso: string;
  defaultDate: string;
}) {
  const [liveSectors, overrides, targets, indicators, fmcg] = await Promise.all([
    getSalesSectors(true).catch(() => []),
    listOverrides(),
    listSalesDepartmentTargets(year),
    listSalesSectorIndicators(periodIso),
    listFmcgManualOverview(periodIso),
  ]);

  const deptMap = new Map<string, string>();
  for (const s of liveSectors) deptMap.set(s.key, s.label);
  for (const o of overrides) if (!deptMap.has(o.code)) deptMap.set(o.code, o.label || o.code);
  for (const t of targets) if (!deptMap.has(t.code)) deptMap.set(t.code, t.code);
  const departments = [...deptMap].map(([code, label]) => ({ code, label }));
  const indicatorLabels = new Map<string, [string, string]>(SALES_INDICATORS.map(([k, l, u]) => [k, [l, u]]));

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sales department monthly targets (Sales &amp; Finance pages)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualSalesTargetForm departments={departments} year={year} month={month} years={years} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Target (QAR)</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((t) => (
                <TableRow key={`${t.code}|${t.period}`}>
                  <TableCell className="font-medium">{deptMap.get(t.code) ?? t.code} <span className="font-mono text-xs text-muted-foreground">({t.code})</span></TableCell>
                  <TableCell>{MONTHS[t.month]} {t.year}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(t.target, 2, 0)}</TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${t.code} target`}
                      message={`Delete target for ${t.code} (${MONTHS[t.month]} ${t.year})?`}
                      fields={{ deleteKind: "salesTarget", code: t.code, period: t.period }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!targets.length && (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                    No sales department targets saved for {year}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sales sector indicators — {MONTHS[month]} {year}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualSalesIndicatorsForm departments={departments} year={year} month={month} years={years} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Indicator</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indicators.map((ind) => {
                const meta = indicatorLabels.get(ind.indicator);
                return (
                  <TableRow key={`${ind.departmentCode}|${ind.indicator}`}>
                    <TableCell>{ind.departmentCode ? (deptMap.get(ind.departmentCode) ?? ind.departmentCode) : "All departments (Group)"}</TableCell>
                    <TableCell className="font-medium">{meta?.[0] ?? ind.indicator}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(ind.value, 2, 0)} {meta?.[1] ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteIconForm
                        label={`Delete ${ind.indicator}`}
                        message={`Delete ${meta?.[0] ?? ind.indicator} for ${MONTHS[month]} ${year}?`}
                        fields={{
                          deleteKind: "salesIndicator",
                          departmentCode: ind.departmentCode,
                          period: ind.period,
                          indicator: ind.indicator,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!indicators.length && (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                    No sector indicators saved for {MONTHS[month]} {year}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">FMCG reference data, salesman targets, stock &amp; control records</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualFmcgForms year={year} month={month} years={years} defaultDate={defaultDate} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Brands ({fmcg.brands.length})</div>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Manager</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {fmcg.brands.slice(0, 15).map((b) => (
                    <TableRow key={b.code}>
                      <TableCell className="font-mono text-xs">{b.code}</TableCell>
                      <TableCell>{b.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.manager ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm label={`Delete ${b.code}`} message={`Delete brand ${b.code}?`} fields={{ deleteKind: "fmcgBrand", code: b.code }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fmcg.brands.length && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">No brands on file.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Salesmen ({fmcg.salesmen.length})</div>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Route</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {fmcg.salesmen.slice(0, 15).map((s) => (
                    <TableRow key={s.code}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.route ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm label={`Delete ${s.code}`} message={`Delete salesman ${s.code}?`} fields={{ deleteKind: "fmcgSalesman", code: s.code }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fmcg.salesmen.length && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">No salesmen on file.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Salesman brand targets — {MONTHS[month]} {year} ({fmcg.assignments.length})</div>
              <Table>
                <TableHeader><TableRow><TableHead>Salesman</TableHead><TableHead>Brand</TableHead><TableHead className="text-right">Target (QAR)</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {fmcg.assignments.slice(0, 15).map((a) => (
                    <TableRow key={`${a.salesmanCode}|${a.brand}`}>
                      <TableCell>{a.salesmanName} <span className="font-mono text-xs text-muted-foreground">({a.salesmanCode})</span></TableCell>
                      <TableCell>{a.brand}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(a.target, 2, 0)}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm
                          label="Delete target"
                          message={`Delete target for ${a.salesmanCode} / ${a.brand}?`}
                          fields={{ deleteKind: "fmcgAssignment", period: a.period, salesmanCode: a.salesmanCode, brand: a.brand }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fmcg.assignments.length && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">No salesman targets for {MONTHS[month]} {year}.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Manager targets — {MONTHS[month]} {year} ({fmcg.managerTargets.length})</div>
              <Table>
                <TableHeader><TableRow><TableHead>Manager</TableHead><TableHead className="text-right">Target (QAR)</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {fmcg.managerTargets.map((t) => (
                    <TableRow key={t.manager}>
                      <TableCell>{t.manager}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(t.target, 2, 0)}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm
                          label="Delete manager target"
                          message={`Delete target for ${t.manager}?`}
                          fields={{ deleteKind: "fmcgManagerTarget", period: t.period, manager: t.manager }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fmcg.managerTargets.length && <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">No manager targets for {MONTHS[month]} {year}.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Recent stock snapshots ({fmcg.stock.length})</div>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Value (QAR)</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {fmcg.stock.slice(0, 12).map((s) => (
                    <TableRow key={`${s.asOf}|${s.itemCode}|${s.location}`}>
                      <TableCell className="font-mono text-xs">{s.asOf}</TableCell>
                      <TableCell>{s.itemCode}</TableCell>
                      <TableCell>{s.location}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.value, 2, 0)}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm
                          label="Delete stock row"
                          message={`Delete stock row ${s.itemCode} @ ${s.location} (${s.asOf})?`}
                          fields={{ deleteKind: "fmcgStockSnapshot", asOf: s.asOf, itemCode: s.itemCode, location: s.location }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fmcg.stock.length && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground">No stock snapshots recorded.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Recent delivery variances, consignments &amp; expiry</div>
              <Table>
                <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Ref / Date</TableHead><TableHead>Item</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {fmcg.variances.slice(0, 5).map((v) => (
                    <TableRow key={`var-${v.doNo}-${v.itemCode}-${v.location}`}>
                      <TableCell><Badge variant="neutral">Variance</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{v.doNo} ({v.doDate})</TableCell>
                      <TableCell>{v.itemCode}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm label="Delete variance" message={`Delete variance ${v.doNo}?`} fields={{ deleteKind: "fmcgVariance", doNo: v.doNo, itemCode: v.itemCode, location: v.location }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {fmcg.consignments.slice(0, 5).map((c) => (
                    <TableRow key={`cns-${c.receivedDate}-${c.lineNo}`}>
                      <TableCell><Badge variant="neutral">Consignment</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{c.consignmentNo} ({c.receivedDate})</TableCell>
                      <TableCell>{c.itemCode}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm label="Delete consignment" message={`Delete consignment ${c.consignmentNo} line ${c.lineNo}?`} fields={{ deleteKind: "fmcgConsignment", receivedDate: c.receivedDate, lineNo: c.lineNo }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {fmcg.expiry.slice(0, 5).map((e) => (
                    <TableRow key={`exp-${e.asOf}-${e.report}-${e.lineNo}`}>
                      <TableCell><Badge variant="neutral">Expiry</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{e.report} ({e.expiryDate})</TableCell>
                      <TableCell>{e.itemCode}</TableCell>
                      <TableCell className="text-right">
                        <DeleteIconForm label="Delete expiry" message={`Delete stock expiry row #${e.lineNo}?`} fields={{ deleteKind: "fmcgExpiry", asOf: e.asOf, report: e.report, lineNo: e.lineNo }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fmcg.variances.length && !fmcg.consignments.length && !fmcg.expiry.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">No control rows recorded.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function FinanceCustomersTab({ companies, defaultDate }: { companies: Company[]; defaultDate: string }) {
  const [snapshots, overdue, opportunities] = await Promise.all([
    listReceivablesSnapshots(),
    listOverdueInvoices(),
    listCustomerOpportunities(),
  ]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receivables outstanding, DSO &amp; aging buckets (Dashboard &amp; Finance)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualReceivablesForm companies={companyOptions} defaultDate={defaultDate} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>As of</TableHead>
                <TableHead className="text-right">DSO</TableHead>
                <TableHead className="text-right">Not due</TableHead>
                <TableHead className="text-right">1–30 d</TableHead>
                <TableHead className="text-right">31–60 d</TableHead>
                <TableHead className="text-right">61–90 d</TableHead>
                <TableHead className="text-right">Over 90 d</TableHead>
                <TableHead className="text-right">Total (QAR)</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.companyName ?? "Group / Unassigned"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.asOf}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.dsoDays !== null ? `${fmt(r.dsoDays, 1)} d` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.notDue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.days1To30)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.days31To60)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.days61To90)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.over90)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmt(r.total)}</TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label="Delete snapshot"
                      message={`Delete receivables snapshot for ${r.companyName ?? "Group"}?`}
                      fields={{ deleteKind: "receivablesSnapshot", id: r.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!snapshots.length && (
                <TableRow><TableCell colSpan={10} className="h-16 text-center text-muted-foreground">No receivables snapshots recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overdue invoices (Finance page)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualOverdueInvoiceForm companies={companyOptions} defaultDate={defaultDate} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Amount (QAR)</TableHead>
                <TableHead className="text-right">Balance (QAR)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdue.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.invoiceNo}</TableCell>
                  <TableCell className="font-medium">{inv.accountName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.companyName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.dueDate}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(inv.amount, 2, 0)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmt(inv.balance, 2, 0)}</TableCell>
                  <TableCell><Badge variant="neutral">{inv.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${inv.invoiceNo}`}
                      message={`Delete overdue invoice ${inv.invoiceNo}?`}
                      fields={{ deleteKind: "overdueInvoice", id: inv.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!overdue.length && (
                <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No overdue invoices recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Customer opportunities (Customers page)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualCustomerOpportunityForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Opportunity</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Expected close</TableHead>
                <TableHead className="text-right">Value (QAR)</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>
                    <span className="font-medium">{op.customerName}</span>
                    {op.customerCode && <span className="ml-1 font-mono text-xs text-muted-foreground">({op.customerCode})</span>}
                  </TableCell>
                  <TableCell>{op.title}</TableCell>
                  <TableCell><Badge variant="neutral">{op.stage}</Badge></TableCell>
                  <TableCell>{op.owner || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{op.expectedClose ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(op.value, 2, 0)}</TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${op.title}`}
                      message={`Delete opportunity "${op.title}"?`}
                      fields={{ deleteKind: "customerOpportunity", id: op.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!opportunities.length && (
                <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No customer opportunities recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function HrTab({ companies, defaultDate }: { companies: Company[]; defaultDate: string }) {
  const [staff, sourceDepts, leaves, docs] = await Promise.all([
    listEmployees(),
    listSourceNames(),
    listHrLeaveRequests(),
    listHrExpiringDocuments(),
  ]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  const recentStaff = [...staff].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 25);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Employee directory — manual add / update (Dashboard &amp; HR)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualEmployeeForm departments={sourceDepts.map((d) => d.name)} defaultDate={defaultDate} />
          <div className="text-xs text-muted-foreground">
            Showing latest {recentStaff.length} of {staff.length} employee{staff.length === 1 ? "" : "s"} on file.
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Left</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentStaff.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.id}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.department || "—"}</TableCell>
                  <TableCell>{e.designation || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.joined}</TableCell>
                  <TableCell className="font-mono text-xs">{e.left ?? "Active"}</TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${e.name}`}
                      message={`Delete employee ${e.name} (${e.id})?`}
                      fields={{ deleteKind: "employee", employeeId: e.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!recentStaff.length && (
                <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No employees recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Leave requests awaiting approval (Dashboard &amp; HR)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualLeaveRequestForm companies={companyOptions} defaultDate={defaultDate} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.employeeName} {l.employeeId && <span className="font-mono text-xs text-muted-foreground">({l.employeeId})</span>}</TableCell>
                  <TableCell>{l.companyName ?? "—"}</TableCell>
                  <TableCell>{l.leaveType}</TableCell>
                  <TableCell className="font-mono text-xs">{l.startDate} → {l.endDate}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(l.days, 1, 0)}</TableCell>
                  <TableCell><Badge variant={l.status === "Pending" ? "secondary" : "neutral"}>{l.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete leave for ${l.employeeName}`}
                      message={`Delete leave request for ${l.employeeName}?`}
                      fields={{ deleteKind: "leaveRequest", id: l.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!leaves.length && (
                <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No leave requests recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Expiring HR &amp; company documents (Dashboard &amp; HR)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualExpiringDocumentForm companies={companyOptions} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holder</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Expiry date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.holderName}</TableCell>
                  <TableCell>{d.companyName ?? "—"}</TableCell>
                  <TableCell>{d.documentType}</TableCell>
                  <TableCell className="font-mono text-xs">{d.documentNo || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{d.expiryDate}</TableCell>
                  <TableCell><Badge variant="neutral">{d.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm
                      label={`Delete ${d.documentType}`}
                      message={`Delete ${d.documentType} record for ${d.holderName}?`}
                      fields={{ deleteKind: "expiringDocument", id: d.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!docs.length && (
                <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No expiring documents recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function LogisticsTab() {
  const { kpis, fleet, shipments, warehouses, customs } = await getLogisticsOverview();

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Logistics KPI summary (Logistics page)</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualLogisticsKpisForm current={kpis} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shipment tracking (Dashboard &amp; Logistics)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualShipmentForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment ID</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.shipmentCode}</TableCell>
                  <TableCell className="font-medium">{s.destination}</TableCell>
                  <TableCell>{s.temperature || "—"}</TableCell>
                  <TableCell>{s.vehicle || "—"}</TableCell>
                  <TableCell>{s.eta || "—"}</TableCell>
                  <TableCell><Badge variant={s.status === "Late" ? "secondary" : "neutral"}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm label={`Delete ${s.shipmentCode}`} message={`Delete shipment ${s.shipmentCode}?`} fields={{ deleteKind: "shipment", id: s.id }} />
                  </TableCell>
                </TableRow>
              ))}
              {!shipments.length && (
                <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No shipments recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fleet vehicles (Logistics page)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualFleetVehicleForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle / Plate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleet.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.vehicleNo}</TableCell>
                  <TableCell>{v.vehicleType || "—"}</TableCell>
                  <TableCell>{v.driverName || "—"}</TableCell>
                  <TableCell>{v.route || "—"}</TableCell>
                  <TableCell>{v.temperatureMode}</TableCell>
                  <TableCell><Badge variant="neutral">{v.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm label={`Delete ${v.vehicleNo}`} message={`Delete vehicle ${v.vehicleNo}?`} fields={{ deleteKind: "fleetVehicle", id: v.id }} />
                  </TableCell>
                </TableRow>
              ))}
              {!fleet.length && (
                <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No fleet vehicles recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Warehouses (Logistics page)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualWarehouseForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Occupied / Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell>{w.location || "—"}</TableCell>
                  <TableCell>{w.temperatureZone}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(w.occupiedPallets)} / {fmt(w.capacityPallets)}</TableCell>
                  <TableCell><Badge variant="neutral">{w.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm label={`Delete ${w.name}`} message={`Delete warehouse ${w.name}?`} fields={{ deleteKind: "warehouse", id: w.id }} />
                  </TableCell>
                </TableRow>
              ))}
              {!warehouses.length && (
                <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No warehouses recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Customs clearance (Logistics page)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ManualCustomsForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill of lading</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.bolNo}</TableCell>
                  <TableCell className="font-medium">{c.customer}</TableCell>
                  <TableCell>{c.port || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.eta ?? "—"}</TableCell>
                  <TableCell><Badge variant="neutral">{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DeleteIconForm label={`Delete ${c.bolNo}`} message={`Delete customs entry ${c.bolNo}?`} fields={{ deleteKind: "customs", id: c.id }} />
                  </TableCell>
                </TableRow>
              ))}
              {!customs.length && (
                <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No customs entries recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

