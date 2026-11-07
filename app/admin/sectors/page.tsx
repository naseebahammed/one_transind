import Link from "next/link";
import { Button } from "@/components/admin/ui/button";
import { AddSectorForm } from "@/components/admin/AddSectorForm";
import { RenameSectorForm } from "@/components/admin/RenameSectorForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Page } from "@/components/admin/Page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { countCompanies, listSectors, PROTECTED_SECTOR_KEYS } from "@/lib/sectors";
import { deleteSector } from "./actions";

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
          {rows.map(([key, name], i) => {
            const used = counts[i];
            const isProtected = PROTECTED_SECTOR_KEYS.has(key);
            return (
              <TableRow key={key}>
                <TableCell>
                  <RenameSectorForm sectorKey={key} name={name} />
                </TableCell>
                <TableCell className="tabular-nums">{used}</TableCell>
                <TableCell className="text-right">
                  <form action={deleteSector} className="flex items-center justify-end gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={`/admin/sectors/${encodeURIComponent(key)}`}>View</Link></Button>
                    <input type="hidden" name="key" value={key} />
                    {used > 0 && <span className="text-xs text-muted-foreground">In use</span>}
                    <ConfirmButton variant="destructive" size="sm" disabled={used > 0 || isProtected} message={`Delete sector ${name}?`}>Delete</ConfirmButton>
                  </form>
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No sectors yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </>
  );
}
