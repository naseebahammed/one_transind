import { notFound } from "next/navigation";
import { loadReports } from "@/lib/al-manzil";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { CompanySectionNav, progress, YearLinks } from "@/components/admin/CompanySectionNav";
import { FigureSectionView } from "@/components/admin/FigureSectionView";
import { PnlSectionView, pnlFilledMonths } from "@/components/admin/PnlSectionView";
import { Page } from "@/components/admin/Page";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { getCompany, listCompanyIds } from "@/lib/companies";
import { isFigureSection, monthStatuses, profileGaps, SECTIONS, type Section } from "@/lib/company-data";
import { listFilledMonths } from "@/lib/company-figures";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";
import { link } from "@/lib/url";
import { deleteCompany } from "../actions";

type Params = Promise<{ id: string }>;
type Search = Promise<{ section?: string; year?: string }>;

export default function EditCompany({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Page title="Edit company" description="Company details and the monthly data it submits.">
      <Edit params={params} searchParams={searchParams} />
    </Page>
  );
}

async function Edit({ params, searchParams }: { params: Params; searchParams: Search }) {
  await loadReports();
  const id = Number((await params).id);
  const { section: rawSection, year: rawYear } = await searchParams;
  const [company, ids, sectors, propertyTypes] = await Promise.all([getCompany(id), listCompanyIds(), listSectors(), listPropertyTypes()]);
  if (!company) notFound();
  const section: Section = SECTIONS.find(([k]) => k === rawSection)?.[0] ?? "profile";
  const today = new Date(), thisYear = today.getFullYear();
  const pastYears = [thisYear - 2, thisYear - 1, thisYear];
  const yearOptions = section === "budget" ? [...pastYears, thisYear + 1] : pastYears; // budgets are set ahead
  const year = yearOptions.includes(Number(rawYear)) ? Number(rawYear) : thisYear;
  const filled = await listFilledMonths(id, year);
  const pnlStatuses = monthStatuses("pnl", year, pnlFilledMonths(company, year), today);
  const figureStatuses = { balance: monthStatuses("balance", year, filled.balance, today), budget: monthStatuses("budget", year, filled.budget, today), people: monthStatuses("people", year, filled.people, today) };
  const gaps = profileGaps(company).length;
  const labels: Record<Section, string> = { profile: gaps ? `${gaps} blank` : "Complete", pnl: progress(pnlStatuses), balance: progress(figureStatuses.balance), budget: progress(figureStatuses.budget), people: progress(figureStatuses.people) };
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
      <CompanySectionNav id={id} section={section} year={year} labels={labels} />
      {section !== "profile" && <YearLinks id={id} section={section} year={year} years={yearOptions} />}
      {section === "pnl" && <PnlSectionView company={company} year={year} statuses={pnlStatuses} />}
      {isFigureSection(section) && <FigureSectionView company={company} section={section} year={year} statuses={figureStatuses[section]} />}
      {section === "profile" && <>
      {/* Activity keeps this page's DOM across navigation, so remount when saved data changes or the inputs show stale values (and re-save them). */}
      <CompanyForm key={JSON.stringify(company)} company={company} sectors={sectors} propertyTypes={propertyTypes} />
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete company</CardTitle>
          <CardDescription>Permanently removes this company from the list. This cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteCompany} className="flex items-center justify-between gap-4">
            <input type="hidden" name="id" value={company.id} />
            <ConfirmButton variant="destructive" message={`Delete ${company.name}? This cannot be undone.`}>Delete company</ConfirmButton>
          </form>
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
