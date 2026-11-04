import Link from "next/link";
import { Activity } from "lucide-react";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/admin/ui/table";
import { MonthBars } from "@/components/admin/FinanceCharts";
import { MONTHS, report, years } from "@/lib/al-manzil";
import { listLog } from "@/lib/db";
import { listCompanies } from "@/lib/companies";

export default function Overview() {
  return (
    <Page title="Dashboard" description="A snapshot of system activity.">
      <Stats />
    </Page>
  );
}

async function Stats() {
  const [log, companies] = await Promise.all([listLog(), listCompanies()]);
  const alManzilId = companies.find((c) => c.name.trim().toLowerCase() === "al manzil")?.id;
  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Al Manzil - revenue vs total cost</CardTitle>
          <Link href={alManzilId ? `/admin/finance?company=${alManzilId}` : "/admin/finance"} className="text-sm text-primary hover:underline">Full report</Link>
        </CardHeader>
        <CardContent>
          <MonthBars label="Al Manzil revenue vs total cost" months={MONTHS} series={years().flatMap((y, i) => { const r = report(y); return [{ name: `Revenue ${y}`, color: ["var(--chart-1)", "var(--chart-2)"][i % 2], data: r.revenue }, { name: `Total cost ${y}`, color: ["var(--chart-3)", "var(--chart-4)"][i % 2], data: r.totalCost }]; })} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" />Recent activity</CardTitle>
            <Link href="/admin/activity" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="[&_[data-slot=table-container]]:border-0">
            <Table>
              <TableBody>
                {log.slice(0, 5).map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-muted-foreground">{l.t}</TableCell>
                    <TableCell>{l.job}</TableCell>
                    <TableCell className="text-right"><Badge variant={l.ok ? "success" : "danger"}>{l.ok ? "OK" : "Failed"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
