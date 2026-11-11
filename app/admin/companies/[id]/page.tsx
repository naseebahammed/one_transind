import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BranchesCard } from "@/components/admin/BranchesCard";
import { CompanyDepartments } from "@/components/admin/CompanyDepartments";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { BranchLinks, CompanySectionNav, progress, YearLinks } from "@/components/admin/CompanySectionNav";
import { FigureSectionView } from "@/components/admin/FigureSectionView";
import { PnlSectionView } from "@/components/admin/PnlSectionView";
import { ReceiptsSectionView } from "@/components/admin/ReceiptsSectionView";
import { SECTOR } from "@/lib/org";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { listBranches } from "@/lib/branches";
import { getCompany, listCompanyIds } from "@/lib/companies";
import { isFigureSection, monthStatuses, profileGaps, SECTIONS, type Section } from "@/lib/company-data";
import { listFilledMonths } from "@/lib/company-figures";
import { parsePositiveIntId } from "@/lib/input-validation";
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
  const [company, ids, sectors, propertyTypes, branches] = await Promise.all([getCompany(id), listCompanyIds(), listSectors(), listPropertyTypes(), listBranches(id)]);
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
  const filled = await listFilledMonths(id, year, branchId);
  const pnlStatuses = monthStatuses("pnl", year, filled.pnl, today);
  const figureStatuses = { balance: monthStatuses("balance", year, filled.balance, today), budget: monthStatuses("budget", year, filled.budget, today), people: monthStatuses("people", year, filled.people, today), expenses: monthStatuses("expenses", year, filled.expenses, today) };
  const gaps = profileGaps(company).length;
  const labels: Record<Section, string> = { profile: gaps ? `${gaps} blank` : "Complete", pnl: progress(pnlStatuses), balance: progress(figureStatuses.balance), budget: progress(figureStatuses.budget), people: progress(figureStatuses.people), expenses: progress(figureStatuses.expenses), daily: "" };
  const sibling = (other: number) => link(`/admin/companies/${other}`, { section, year: rawYear });
  const index = ids.findIndex((c) => c.id === id);
  const prevId = index > 0 ? ids[index - 1].id : null;
  const nextId = index >= 0 && index < ids.length - 1 ? ids[index + 1].id : null;
  return (
    <div className="space-y-4">
      <Card className="flex-row flex-wrap items-center gap-x-8 gap-y-1 px-6 py-2 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          {company.name}
          <Badge variant={company.active ? "success" : "neutral"}>{company.active ? "Active" : "Inactive"}</Badge>
        </span>
        <span><span className="text-muted-foreground">Sector: </span><span className="font-medium">{sectors.find(([k]) => k === company.sector)?.[1] ?? company.sector}</span></span>
        <span className="ml-auto flex gap-2">
          {prevId === null ? (
            <Button variant="outline" size="icon-sm" disabled><ChevronLeft /></Button>
          ) : (
            <Button asChild variant="outline" size="icon-sm"><Link href={sibling(prevId)} aria-label="Previous company"><ChevronLeft /></Link></Button>
          )}
          {nextId === null ? (
            <Button variant="outline" size="icon-sm" disabled><ChevronRight /></Button>
          ) : (
            <Button asChild variant="outline" size="icon-sm"><Link href={sibling(nextId)} aria-label="Next company"><ChevronRight /></Link></Button>
          )}
        </span>
      </Card>
      <CompanySectionNav id={id} section={section} year={year} labels={labels} branchId={branchId} hidden={showDaily ? [] : ["daily"]} />
      {section !== "profile" && activeBranches.length > 0 && <BranchLinks id={id} section={section} year={year} branches={activeBranches} branchId={branchId} />}
      {section !== "profile" && <YearLinks id={id} section={section} year={year} years={yearOptions} branchId={branchId} />}
      {section === "pnl" && <PnlSectionView company={company} year={year} statuses={pnlStatuses} branchId={branchId} />}
      {isFigureSection(section) && <FigureSectionView company={company} section={section} year={year} statuses={figureStatuses[section]} branchId={branchId} />}
      {section === "daily" && <ReceiptsSectionView company={company} year={year} month={month} branchId={branchId} />}
      {section === "profile" && <>
      {/* Activity keeps this page's DOM across navigation, so remount when saved data changes or the inputs show stale values (and re-save them). */}
      <CompanyForm key={JSON.stringify(company)} company={company} sectors={sectors} propertyTypes={propertyTypes} />
      <BranchesCard key={JSON.stringify([company.has_branches, branches])} companyId={id} enabled={!!company.has_branches} branches={branches} />
      <CompanyDepartments companyId={id} />
      </>}
    </div>
  );
}
