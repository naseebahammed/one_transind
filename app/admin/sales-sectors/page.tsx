import { Eye, EyeOff } from "lucide-react";
import { Page } from "@/components/admin/Page";
import { SaveButton } from "@/components/admin/SaveButton";
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
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Database name</TableHead>
          <TableHead>Display name</TableHead>
          <TableHead>Home sector</TableHead>
          <TableHead className="text-right">Visibility</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.code} className={r.hidden ? "opacity-65" : undefined}>
            <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
            <TableCell className="font-medium">{r.db}</TableCell>
            <TableCell>
              <form action={saveSalesSector} className="flex max-w-sm items-center gap-2">
                <input type="hidden" name="code" value={r.code} />
                <Input name="label" defaultValue={r.label ?? ""} placeholder={r.db} maxLength={60} aria-label={`Display name for ${r.db}`} className="h-8" />
                <SaveButton variant="outline" size="sm" />
              </form>
            </TableCell>
            <TableCell>
              <form action={assignSalesSector} className="flex max-w-xs items-center gap-2">
                <input type="hidden" name="code" value={r.code} />
                <NativeSelect name="sector" defaultValue={r.sector} aria-label={`Sector for ${r.db}`} className="h-8">
                  <option value="">Unassigned</option>
                  {sectors.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </NativeSelect>
                <SaveButton variant="outline" size="sm" />
              </form>
            </TableCell>
            <TableCell className="text-right">
              <form action={toggleSalesSector} className="inline-flex justify-end">
                <input type="hidden" name="code" value={r.code} />
                <SaveButton
                  variant={r.hidden ? "secondary" : "outline"}
                  size="sm"
                  pendingLabel="Updating…"
                  showSavedState={false}
                >
                  {r.hidden ? (
                    <>
                      <EyeOff className="size-3.5 text-muted-foreground" />
                      Hidden · show
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5 text-success" />
                      Shown · hide
                    </>
                  )}
                </SaveButton>
              </form>
            </TableCell>
          </TableRow>
        ))}
        {!rows.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No departments found.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}
