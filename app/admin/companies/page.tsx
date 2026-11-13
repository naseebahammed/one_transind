import Link from "next/link";
import { CompaniesList } from "@/components/admin/CompaniesList";
import { Page } from "@/components/admin/Page";
import { Button } from "@/components/admin/ui/button";
import { listCompanies } from "@/lib/companies";
import { listExpenseTotals } from "@/lib/company-figures";
import { listPropertyTypes } from "@/lib/property-types";
import { listSectors } from "@/lib/sectors";

type Search = Promise<{ q?: string; sector?: string; status?: string }>;

export default function Companies({ searchParams }: { searchParams: Search }) {
  return (
    <Page title="Companies" description="Manage the companies you work with." action={<Button asChild><Link href="/admin/companies/new">Add company</Link></Button>}>
      <List searchParams={searchParams} />
    </Page>
  );
}

async function List({ searchParams }: { searchParams: Search }) {
  const { q = "", sector = "", status = "all" } = await searchParams;
  const [rows, sectors, propertyTypes, totals] = await Promise.all([
    listCompanies(),
    listSectors(),
    listPropertyTypes(),
    listExpenseTotals(),
  ]);
  const years = [...new Set(totals.map((t) => t.year))].sort();
  const initialStatus = status === "active" || status === "inactive" ? status : "all";
  return (
    <CompaniesList
      companies={rows}
      sectors={sectors}
      propertyTypes={propertyTypes}
      years={years}
      expenseTotals={totals}
      initialQuery={q}
      initialSector={sector}
      initialStatus={initialStatus}
    />
  );
}
