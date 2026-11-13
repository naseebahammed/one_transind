import { notFound } from "next/navigation";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { BranchesCard } from "@/components/admin/BranchesCard";
import { CompanyDepartments } from "@/components/admin/CompanyDepartments";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { CompanyReceivablesCard } from "@/components/admin/CompanyReceivablesCard";
import { CompanyScopeBar, CompanySectionNav, progress } from "@/components/admin/CompanySectionNav";
import { FigureSectionView } from "@/components/admin/FigureSectionView";
import { PnlSectionView } from "@/components/admin/PnlSectionView";
import { ReceiptsSectionView } from "@/components/admin/ReceiptsSectionView";
import { SECTOR } from "@/lib/org";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { listBranches } from "@/lib/branches";
import { getCompany, listCompanies } from "@/lib/companies";
import { isFigureSection, monthStatuses, profileGaps, SECTIONS, type Section } from "@/lib/company-data";
import { listFilledMonths } from "@/lib/company-figures";
import { parsePositiveIntId } from "@/lib/input-validation";
import { getCompanyReceivablesSnapshot } from "@/lib/receivables-rollup";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";
import { link } from "@/lib/url";

type Params = Promise<{ id: string }>;
type Search = Promise<{ section?: string; year?: string; branch?: string; month?: string }>;

export default function EditCompany({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Page title="Edit company" description="Company details and the monthly data it submits.">
      <Edit params={params} searchParams={searchParams} />
    </Page>
  );
}

async function Edit({ params, searchParams }: { params: Params; searchParams: Search }) {
  const id = parsePositiveIntId((await params).id);
  if (!id) notFound();
  const { section: rawSection, year: rawYear, branch: rawBranch, month: rawMonth } = await searchParams;
  const [company, ids, sectors, propertyTypes, branches] = await Promise.all([getCompany(id), listCompanies(), listSectors(), listPropertyTypes(), listBranches(id)]);
  if (!company) notFound();
  const showDaily = company.sector === SECTOR.foodBeverage && !!company.has_branches;
  const section: Section = SECTIONS.find(([k]) => k === rawSection && (k !== "daily" || showDaily))?.[0] ?? "profile";
  const month = Number.isInteger(Number(rawMonth)) && Number(rawMonth) >= 0 && Number(rawMonth) <= 11 && rawMonth ? Number(rawMonth) : new Date().getMonth();
  const today = new Date(), thisYear = today.getFullYear();
  const pastYears = [thisYear - 2, thisYear - 1, thisYear];
  const yearOptions = section === "budget" ? [...pastYears, thisYear + 1] : pastYears; // budgets are set ahead
  const year = yearOptions.includes(Number(rawYear)) ? Number(rawYear) : thisYear;
  const activeBranches = company.has_branches ? branches.filter((b) => b.active) : [];
  const branchId = activeBranches.find((b) => String(b.id) === rawBranch)?.id ?? null;
  const [filled, receivablesSnapshot] = await Promise.all([
    listFilledMonths(id, year, branchId),
    company.sector !== SECTOR.trading && section === "profile" ? getCompanyReceivablesSnapshot(id) : Promise.resolve(null),
  ]);
  const pnlStatuses = monthStatuses("pnl", year, filled.pnl, today);
  const figureStatuses = { budget: monthStatuses("budget", year, filled.budget, today), people: monthStatuses("people", year, filled.people, today), expenses: monthStatuses("expenses", year, filled.expenses, today) };
  const gaps = profileGaps(company).length;
  const labels: Record<Section, string> = { profile: gaps ? `${gaps} blank` : "Complete", pnl: progress(pnlStatuses), budget: progress(figureStatuses.budget), people: progress(figureStatuses.people), expenses: progress(figureStatuses.expenses), daily: "" };
  const sibling = (other: number) => link(`/admin/companies/${other}`, { section, year: rawYear });
  const index = ids.findIndex((c) => c.id === id);
  const prevCompany = index > 0 ? ids[index - 1] : null;
  const nextCompany = index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;
  const sectorLabel = sectors.find(([k]) => k === company.sector)?.[1] ?? company.sector;

  return (
    <div className="space-y-4">
      <Card flush>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-5 py-3 text-sm">
          <span className="flex items-center gap-2.5 font-semibold">
            {company.has_logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/companies/${company.id}/logo`} alt="" className="size-7 rounded-md border bg-card object-contain p-0.5" />
            )}
            <span className="text-base">{company.name}</span>
            <Badge variant={company.active ? "success" : "neutral"}>{company.active ? "Active" : "Inactive"}</Badge>
          </span>
          <span className="text-muted-foreground">
            Sector: <span className="font-medium text-foreground">{sectorLabel}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/finance?company=${company.id}`}>
                <BarChart3 className="size-3.5" />
                Finance view
              </Link>
            </Button>
            <div className="flex items-center gap-1">
              {prevCompany === null ? (
                <Button variant="outline" size="icon-sm" disabled aria-label="Previous company"><ChevronLeft /></Button>
              ) : (
                <Button asChild variant="outline" size="icon-sm">
                  <Link href={sibling(prevCompany.id)} aria-label={`Previous company: ${prevCompany.name}`} title={`Previous: ${prevCompany.name}`}>
                    <ChevronLeft />
                  </Link>
                </Button>
              )}
              {nextCompany === null ? (
                <Button variant="outline" size="icon-sm" disabled aria-label="Next company"><ChevronRight /></Button>
              ) : (
                <Button asChild variant="outline" size="icon-sm">
                  <Link href={sibling(nextCompany.id)} aria-label={`Next company: ${nextCompany.name}`} title={`Next: ${nextCompany.name}`}>
                    <ChevronRight />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
        <CompanySectionNav id={id} section={section} year={year} labels={labels} branchId={branchId} hidden={showDaily ? [] : ["daily"]} embedded />
      </Card>

      {section !== "profile" && (
        <CompanyScopeBar
          id={id}
          section={section}
          year={year}
          years={yearOptions}
          branches={activeBranches}
          branchId={branchId}
        />
      )}

      {section === "pnl" && <PnlSectionView company={company} year={year} statuses={pnlStatuses} branchId={branchId} />}
      {isFigureSection(section) && <FigureSectionView company={company} section={section} year={year} statuses={figureStatuses[section]} branchId={branchId} />}
      {section === "daily" && <ReceiptsSectionView company={company} year={year} month={month} branchId={branchId} />}
      {section === "profile" && <>
      {/* Activity keeps this page's DOM across navigation, so remount when saved data changes or the inputs show stale values (and re-save them). */}
      <CompanyForm key={JSON.stringify(company)} company={company} sectors={sectors} propertyTypes={propertyTypes} />
      {company.sector !== SECTOR.trading && (
        <CompanyReceivablesCard
          key={JSON.stringify(receivablesSnapshot)}
          companyId={id}
          companyName={company.name}
          snapshot={receivablesSnapshot}
        />
      )}
      <BranchesCard key={JSON.stringify([company.has_branches, branches])} companyId={id} enabled={!!company.has_branches} branches={branches} />
      <CompanyDepartments companyId={id} />
      </>}
    </div>
  );
}
