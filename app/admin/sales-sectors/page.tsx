import { Page } from "@/components/admin/Page";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { listSectors } from "@/lib/sectors";
import { getSales } from "./data";
import { assignSalesSector, saveSalesSector, toggleSalesSector } from "./actions";

export default function SalesSectors() {
  return (
    <Page title="Sales sectors" description="Departments from the sales database that appear as sectors on the Sales page. Rename or hide them here; the data itself is unchanged.">
      <List />
    </Page>
  );
}

async function List() {
  const [rows, sectors] = await Promise.all([getSales(), listSectors()]);
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Database name</TableHead><TableHead>Display name</TableHead><TableHead>Home sector</TableHead><TableHead className="text-right">Visible</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.code}>
            <TableCell className="font-mono text-xs">{r.code}</TableCell>
            <TableCell>{r.db}</TableCell>
            <TableCell>
              <form action={saveSalesSector} className="flex max-w-sm gap-2">
                <input type="hidden" name="code" value={r.code} />
                <Input name="label" defaultValue={r.label ?? ""} placeholder={r.db} maxLength={60} aria-label={`Display name for ${r.db}`} />
                <Button type="submit" variant="outline" size="sm">Save</Button>
              </form>
            </TableCell>
            <TableCell>
              <form action={assignSalesSector} className="flex max-w-xs gap-2">
                <input type="hidden" name="code" value={r.code} />
                <NativeSelect name="sector" defaultValue={r.sector} aria-label={`Sector for ${r.db}`}>
                  <option value="">Unassigned</option>
                  {sectors.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </NativeSelect>
                <Button type="submit" variant="outline" size="sm">Save</Button>
              </form>
            </TableCell>
            <TableCell className="text-right">
              <form action={toggleSalesSector}>
                <input type="hidden" name="code" value={r.code} />
                <Button type="submit" variant={r.hidden ? "secondary" : "outline"} size="sm">{r.hidden ? "Hidden · show" : "Shown · hide"}</Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
        {!rows.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No departments found.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}
