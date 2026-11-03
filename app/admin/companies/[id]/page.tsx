import { notFound } from "next/navigation";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { Page } from "@/components/admin/Page";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { tone } from "@/components/admin/tones";
import { getCompany } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";
import { deleteCompany } from "../actions";

export default function EditCompany({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Edit company" description="Update details or remove this company.">
      <Edit params={params} />
    </Page>
  );
}

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const company = await getCompany(Number((await params).id));
  if (!company) notFound();
  const sectors = await listSectors();
  return (
    <div className="space-y-6">
      <Card className="flex-row flex-wrap items-center gap-x-8 gap-y-1 px-6 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          {company.name}
          <Badge className={company.active ? tone.green : tone.gray}>{company.active ? "Active" : "Inactive"}</Badge>
        </span>
        <span><span className="text-muted-foreground">Sector: </span><span className="font-medium">{sectors.find(([k]) => k === company.sector)?.[1] ?? company.sector}</span></span>
      </Card>
      <CompanyForm company={company} sectors={sectors} />
      <Card className="max-w-2xl border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Permanently removes this company from the list. This cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteCompany} className="flex items-center justify-between gap-4">
            <input type="hidden" name="id" value={company.id} />
            <ConfirmButton variant="destructive" message={`Delete ${company.name}? This cannot be undone.`}>Delete company</ConfirmButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
