import Link from "next/link";
import { Button } from "@/components/admin/ui/button";
import { AddSectorForm } from "@/components/admin/AddSectorForm";
import { Page } from "@/components/admin/Page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { countCompanies, listSectors } from "@/lib/sectors";

export default function Sectors() {
  return (
    <Page title="Sectors" description="Manage the sectors companies are grouped under.">
      <List />
    </Page>
  );
}

async function List() {
  const rows = await listSectors();
  const counts = await Promise.all(rows.map(([key]) => countCompanies(key)));
  return (
    <>
      <AddSectorForm />
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Companies</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(([key, name], i) => (
            <TableRow key={key}>
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell className="tabular-nums">{counts[i]}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm"><Link href={`/admin/sectors/${encodeURIComponent(key)}`}>View</Link></Button>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No sectors yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </>
  );
}
