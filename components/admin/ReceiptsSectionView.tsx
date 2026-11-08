import Link from "next/link";
import { UploadReport } from "@/components/admin/UploadReport";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { MONTHS } from "@/lib/company-data";
import { listReceipts } from "@/lib/company-figures";
import { receiptTable } from "@/lib/receipts";
import { fmt } from "@/lib/format";
import { SECTOR } from "@/lib/org";
import { link } from "@/lib/url";

const amount = (n: number | undefined) => (n === undefined ? "" : fmt(n, 2, 2));

/** A branch's Daily Sales Deposit sheet for one month. Gross sales is calculated here, never stored. */
export async function ReceiptsSectionView({ company, year, month, branchId }: { company: { id: number; sector: string }; year: number; month: number; branchId: number | null }) {
  const t = branchId ? receiptTable(await listReceipts(branchId, year, month), year, month) : null;
  const retail = company.sector === SECTOR.retail;
  const href = (m: number) => link(`/admin/companies/${company.id}`, { section: "daily", year: String(year), month: String(m), branch: branchId ? String(branchId) : undefined });
  return (
    <>
      <Card className="gap-2 py-3">
        <CardHeader>
          <CardTitle className="text-sm">{retail ? "Upload the monthly sales" : "Upload the daily sales deposit"}</CardTitle>
          <CardDescription>Pick a branch above, then upload its {retail ? "monthly sales" : "Daily Sales Deposit"} workbook.</CardDescription>
        </CardHeader>
        <CardContent><UploadReport companyId={company.id} sector={company.sector} branchId={branchId} initialType={retail ? "dukan" : "receipts"} /></CardContent>
      </Card>
      <Card className="flex-row flex-wrap items-center gap-2 px-6 py-2 text-sm">
        <span className="text-muted-foreground">Month</span>
        {MONTHS.map((name, m) => (
          <Button key={name} asChild size="sm" variant={m === month ? "secondary" : "outline"}>
            <Link href={href(m)} aria-current={m === month ? "page" : undefined}>{name}</Link>
          </Button>
        ))}
      </Card>
      {!t ? (
        <Card className="px-6 py-4 text-sm text-muted-foreground">Choose a branch to see its daily sales.</Card>
      ) : (
        <Card className="gap-2 py-3">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Gross sales</TableHead>
                  {t.columns.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.days.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell>{String(d.day).padStart(2, "0")}-{MONTHS[month]}</TableCell>
                    <TableCell className="text-right font-medium">{amount(d.gross ?? undefined)}</TableCell>
                    {t.columns.map((c) => <TableCell key={c} className="text-right">{amount(d.values[c])}</TableCell>)}
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{amount(t.gross)}</TableCell>
                  {t.columns.map((c) => <TableCell key={c} className="text-right">{amount(t.totals[c])}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
