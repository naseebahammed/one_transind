import { AddCompanyTypeForm } from "@/components/admin/AddCompanyTypeForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Page } from "@/components/admin/Page";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { countCompaniesByPropertyType, listPropertyTypes } from "@/lib/property-types";
import { deletePropertyType, renamePropertyType } from "./actions";

export default function CompanyTypes() {
  return (
    <Page title="Company types" description="Manage the property types companies can be tagged with.">
      <List />
    </Page>
  );
}

async function List() {
  const rows = await listPropertyTypes();
  const counts = await Promise.all(rows.map(([key]) => countCompaniesByPropertyType(key)));
  return (
    <>
      <AddCompanyTypeForm />
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Companies</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(([key, name], i) => {
            const used = counts[i];
            return (
              <TableRow key={key}>
                <TableCell>
                  <form action={renamePropertyType} className="flex max-w-sm gap-2">
                    <input type="hidden" name="key" value={key} />
                    <Input name="name" defaultValue={name} required maxLength={60} aria-label={`Name for ${name}`} />
                    <Button type="submit" variant="outline" size="sm">Rename</Button>
                  </form>
                </TableCell>
                <TableCell className="tabular-nums">{used}</TableCell>
                <TableCell className="text-right">
                  <form action={deletePropertyType}>
                    <input type="hidden" name="key" value={key} />
                    <ConfirmButton variant="destructive" size="sm" disabled={used > 0} title={used ? "Move or delete its companies first" : undefined} message={`Delete company type ${name}?`}>Delete</ConfirmButton>
                  </form>
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length && <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No company types yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </>
  );
}
