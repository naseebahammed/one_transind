import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { Page } from "@/components/admin/Page";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { getCompany, listCompanyIds } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";
import { listPropertyTypes } from "@/lib/property-types";
import { deleteCompany } from "../actions";

export default function EditCompany({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Edit company" description="Update details or remove this company.">
      <Edit params={params} />
    </Page>
  );
}

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [company, ids, sectors, propertyTypes] = await Promise.all([getCompany(id), listCompanyIds(), listSectors(), listPropertyTypes()]);
  if (!company) notFound();
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
            <Button asChild variant="outline" size="icon-sm"><Link href={`/admin/companies/${prevId}`} aria-label="Previous company"><ChevronLeft /></Link></Button>
          )}
          {nextId === null ? (
            <Button variant="outline" size="icon-sm" disabled><ChevronRight /></Button>
          ) : (
            <Button asChild variant="outline" size="icon-sm"><Link href={`/admin/companies/${nextId}`} aria-label="Next company"><ChevronRight /></Link></Button>
          )}
        </span>
      </Card>
      <CompanyForm company={company} sectors={sectors} propertyTypes={propertyTypes} />
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
    </div>
  );
}
