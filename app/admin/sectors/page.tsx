import { AddSectorForm } from "@/components/admin/AddSectorForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Page } from "@/components/admin/Page";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { countCompanies, listSectors } from "@/lib/sectors";
import { deleteSector, renameSector } from "./actions";

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
            return (
              <TableRow key={key}>
                <TableCell>
                  <form action={renameSector} className="flex max-w-sm gap-2">
                    <input type="hidden" name="key" value={key} />
                    <Input name="name" defaultValue={name} required maxLength={60} aria-label={`Name for ${name}`} />
                    <Button type="submit" variant="outline" size="sm">Rename</Button>
                  </form>
                </TableCell>
                <TableCell className="tabular-nums">{used}</TableCell>
                <TableCell className="text-right">
                  <form action={deleteSector}>
                    <input type="hidden" name="key" value={key} />
                    <ConfirmButton variant="destructive" size="sm" disabled={used > 0} title={used ? "Move or delete its companies first" : undefined} message={`Delete sector ${name}?`}>Delete</ConfirmButton>
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
