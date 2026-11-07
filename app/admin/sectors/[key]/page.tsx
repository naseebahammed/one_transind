import { notFound } from "next/navigation";
import { CompanyRow } from "@/components/admin/CompanyRow";
import { Page } from "@/components/admin/Page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listCompanies } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";

type Params = Promise<{ key: string }>;

export default function SectorDetails({ params }: { params: Params }) {
  return (
    <Page title="Sector" description="Companies grouped under this sector.">
      <List params={params} />
    </Page>
  );
}

async function List({ params }: { params: Params }) {
  const key = decodeURIComponent((await params).key);
  const [sectors, rows] = await Promise.all([listSectors(), listCompanies("", key)]);
  const name = sectors.find(([k]) => k === key)?.[1];
  if (!name) notFound();
  return (
    <>
      <h2 className="text-lg font-semibold">{name} <span className="text-sm font-normal text-muted-foreground">· {rows.length} {rows.length === 1 ? "company" : "companies"}</span></h2>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Name</TableHead><TableHead>Sector</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => <CompanyRow key={c.id} company={c} sectorLabel={name} />)}
          {!rows.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No companies in this sector yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </>
  );
}
