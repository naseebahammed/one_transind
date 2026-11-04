import Link from "next/link";
import { Search } from "lucide-react";
import { CompanyRow } from "@/components/admin/CompanyRow";
import { Page } from "@/components/admin/Page";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listCompanies } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";

type Search = Promise<{ q?: string; sector?: string }>;

export default function Companies({ searchParams }: { searchParams: Search }) {
  return (
    <Page title="Companies" description="Manage the companies you work with." action={<Button asChild><Link href="/admin/companies/new">Add company</Link></Button>}>
      <List searchParams={searchParams} />
    </Page>
  );
}

async function List({ searchParams }: { searchParams: Search }) {
  const { q = "", sector = "" } = await searchParams;
  const [rows, SECTORS] = await Promise.all([listCompanies(q, sector), listSectors()]);
  const filtered = !!(q || sector);
  return (
    <>
      <form className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search by name" className="pl-9" />
        </div>
        <NativeSelect name="sector" defaultValue={sector} aria-label="Filter by sector" className="min-w-44 bg-card">
          <option value="">All sectors</option>
          {SECTORS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
        <Button type="submit">Filter</Button>
        {filtered && <Button asChild variant="ghost"><Link href="/admin/companies">Clear</Link></Button>}
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "company" : "companies"}</span>
      </form>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Name</TableHead><TableHead>Sector</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <CompanyRow key={c.id} company={c} sectorLabel={SECTORS.find(([k]) => k === c.sector)?.[1] ?? c.sector} />
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                {filtered ? "No companies match your search." : "No companies yet. Click Add company to create the first one."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
