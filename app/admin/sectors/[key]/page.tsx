import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { CompanyRow } from "@/components/admin/CompanyRow";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Page } from "@/components/admin/Page";
import { RenameSectorForm } from "@/components/admin/RenameSectorForm";
import { Button } from "@/components/admin/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listCompanies } from "@/lib/companies";
import { listPropertyTypes } from "@/lib/property-types";
import { listSectors, PROTECTED_SECTOR_KEYS } from "@/lib/sectors";
import { deleteSector } from "../actions";

type Params = Promise<{ key: string }>;

export default function SectorDetails({ params }: { params: Params }) {
  return (
    <Page title="Sector" description="Rename this sector and see the companies grouped under it.">
      <List params={params} />
    </Page>
  );
}

async function List({ params }: { params: Params }) {
  const key = decodeURIComponent((await params).key);
  const [sectors, propertyTypes, rows] = await Promise.all([listSectors(), listPropertyTypes(), listCompanies("", key)]);
  const typeNames = new Map(propertyTypes);
  const index = sectors.findIndex(([k]) => k === key);
  if (index < 0) notFound();
  const name = sectors[index][1];
  const prevKey = sectors[index - 1]?.[0];
  const nextKey = sectors[index + 1]?.[0];
  const sectorHref = (k: string) => `/admin/sectors/${encodeURIComponent(k)}`;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/admin/sectors"><ArrowLeft /> Back to sectors</Link></Button>
        <span className="flex gap-2">
          {prevKey === undefined ? (
            <Button variant="outline" size="icon-sm" disabled><ChevronLeft /></Button>
          ) : (
            <Button asChild variant="outline" size="icon-sm"><Link href={sectorHref(prevKey)} aria-label="Previous sector"><ChevronLeft /></Link></Button>
          )}
          {nextKey === undefined ? (
            <Button variant="outline" size="icon-sm" disabled><ChevronRight /></Button>
          ) : (
            <Button asChild variant="outline" size="icon-sm"><Link href={sectorHref(nextKey)} aria-label="Next sector"><ChevronRight /></Link></Button>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RenameSectorForm key={name} sectorKey={key} name={name} />
        <form action={deleteSector}>
          <input type="hidden" name="key" value={key} />
          <ConfirmButton size="sm" disabled={rows.length > 0 || PROTECTED_SECTOR_KEYS.has(key)} message={`Delete sector ${name}?`}>Delete sector</ConfirmButton>
        </form>
      </div>
      <h2 className="text-lg font-semibold">Companies <span className="text-sm font-normal text-muted-foreground">· {rows.length} {rows.length === 1 ? "company" : "companies"}</span></h2>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Name</TableHead><TableHead>Sector</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => <CompanyRow key={c.id} company={c} sectorLabel={name} propertyTypeLabel={typeNames.get(c.property_type)} />)}
          {!rows.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No companies in this sector yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </>
  );
}
