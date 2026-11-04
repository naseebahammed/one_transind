import Link from "next/link";
import { StatusBadge } from "@/components/admin/CompanySectionNav";
import { UploadReport } from "@/components/admin/UploadReport";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { keyFor, plRows } from "@/lib/al-manzil";
import { MONTHS, type MonthStatus } from "@/lib/company-data";
import { link } from "@/lib/url";

// shortcut: P&L CSV stores blanks as 0, so a zero month reads as not submitted; fix by storing blanks as null.
export const pnlFilledMonths = (c: { id: number; name: string }, year: number) =>
  new Set(MONTHS.flatMap((_, m) => (plRows(year, keyFor(c)).some((r) => r.m[m]) ? [m] : [])));

export function PnlSectionView({ company, year, statuses }: { company: { id: number; name: string; sector: string }; year: number; statuses: MonthStatus[] }) {
  return (
    <>
      <Card className="gap-2 py-3">
        <CardHeader>
          <CardTitle className="text-sm">Request and upload</CardTitle>
          <CardDescription>Download a template, fill it in, then upload it here. Only the months in the file change. <Link className="underline" href={link("/admin/finance", { company: String(company.id), year: String(year) })}>View the full P&amp;L</Link></CardDescription>
        </CardHeader>
        <CardContent><UploadReport companyId={company.id} companyKey={keyFor(company)} sector={company.sector} /></CardContent>
      </Card>
      <Card className="gap-2 py-3">
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Template</TableHead></TableRow></TableHeader>
            <TableBody>
              {MONTHS.map((name, m) => (
                <TableRow key={name}>
                  <TableCell>{name} {year}</TableCell>
                  <TableCell><StatusBadge status={statuses[m]} /></TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm"><a href={`/api/companies/${company.id}/template?section=pnl&year=${year}&month=${m}`}>Download</a></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
