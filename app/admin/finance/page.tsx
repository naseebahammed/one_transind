import Link from "next/link";
import { Page } from "@/components/admin/Page";
import { tone } from "@/components/admin/tones";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { HBars } from "@/components/admin/FinanceCharts";
import { UploadReport } from "@/components/admin/UploadReport";
import { EditPnlFigure } from "@/components/admin/EditPnlFigure";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteDailyYear, deletePnlYear, savePnlCell, saveSalesCell } from "../al-manzil/actions";
import { keyFor, MONTHS, plRows, report, sum, years } from "@/lib/al-manzil";
import { listCompanies, type Company } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";

const n = (v: number) => Math.round(v).toLocaleString("en");
const neg = (v: number) => (v < 0 ? "text-red-600" : "");

/** Years on file for this company's P&L, each year's figures. Empty until a statement is uploaded for it. */
const reportsFor = (c: Company) => { const key = keyFor(c); return years(key).map((year) => { const r = report(year, key); return { year, revenue: r.revenue, cost: r.totalCost, net: r.net, costGroups: r.costGroups }; }); };

/** One row per year of the company's monthly sales grid (same shape as P&L), summed over the year. Empty until a report is uploaded. */
const salesFor = (c: Company) => {
  const key = keyFor(c);
  return years(key, "sales").map((year) => {
    const by = new Map(plRows(year, key, "sales").map((r) => [`${r.main}|${r.sub}`, sum(r.m)]));
    return { year, sold: by.get("ROOMS|Occupied") ?? 0, avail: by.get("ROOMS|Available") ?? 0, room: by.get("REVENUE|Room revenue") ?? 0, other: by.get("REVENUE|Other revenue") ?? 0 };
  });
};

type Row = { c: Company; kind: "none" } | { c: Company; kind: "pnl"; r: ReturnType<typeof reportsFor>[number] } | { c: Company; kind: "sales"; r: ReturnType<typeof salesFor>[number] };

type Search = Promise<{ company?: string; year?: string; sales?: string }>;

export default function Finance({ searchParams }: { searchParams: Search }) {
  return <Page title="Company finance" description="Profit & loss summary for each company with a finance report."><Summary searchParams={searchParams} /></Page>;
}

async function Summary({ searchParams }: { searchParams: Search }) {
  const { company, year: yr, sales: sy } = await searchParams;
  const sectors = await listSectors();
  const rows = (await listCompanies()).filter((c) => !company || String(c.id) === company).flatMap((c) => { const rs = reportsFor(c); return (rs.length ? rs : [undefined]).map((r) => ({ c, r })); });
  const withData = rows.filter((x) => x.r);
  const companies = new Set(rows.map((x) => x.c.id)).size, withReport = new Set(withData.map((x) => x.c.id)).size;
  const byYear = years().map((year) => {
    const rs = withData.filter((x) => x.r!.year === year).map((x) => x.r!);
    const top = rs.flatMap((r) => r.costGroups).map(([name, d]) => [name, sum(d)] as [string, number]).sort((a, b) => b[1] - a[1]); // all lines, so the percentages are shares of total cost
    return { year, top };
  });
  const one = company ? rows[0]?.c : undefined;
  const key = one && keyFor(one);
  const ys = key ? years(key) : [];
  const edit = one && yr && ys.includes(+yr) ? +yr : undefined; // the P&L table shows only after View (?year=) is clicked
  const salesRows = [...new Map(rows.map((x) => [x.c.id, x.c])).values()].flatMap((c) => salesFor(c).map((r) => ({ c, r })));
  const salesYear = one && sy && salesRows.some((x) => x.c.id === one.id && x.r.year === +sy) ? +sy : undefined; // the sales grid shows only after View (?sales=) is clicked
  const uniqueCompanies = [...new Map(rows.map((x) => [x.c.id, x.c])).values()];
  const pnlAll: Row[] = uniqueCompanies.flatMap((c): Row[] => {
    const items: Row[] = rows.filter((x) => x.c.id === c.id && x.r).map((x) => ({ c, kind: "pnl" as const, r: x.r! }));
    return items.length ? items : [{ c, kind: "none" }];
  });
  const salesAll: Row[] = uniqueCompanies.flatMap((c): Row[] => {
    const items: Row[] = salesRows.filter((x) => x.c.id === c.id).map((x) => ({ c, kind: "sales" as const, r: x.r }));
    return items.length ? items : [{ c, kind: "none" }];
  });
  return (
    <>
      {one && (
        <>
          <Card className="flex-row flex-wrap items-center gap-x-8 gap-y-1 px-6 py-3 text-sm">
            <span className="flex items-center gap-2 font-semibold">{one.name}<Badge className={one.active ? tone.green : tone.gray}>{one.active ? "Active" : "Inactive"}</Badge></span>
            {([["Sector", sectors.find(([k]) => k === one.sector)?.[1] ?? one.sector]] as const).map(([l, v]) => (
              <span key={l}><span className="text-muted-foreground">{l}: </span><span className="font-medium">{v || "-"}</span></span>
            ))}
          </Card>
          <Card><CardHeader><CardTitle>Upload files</CardTitle></CardHeader><CardContent>
            <UploadReport companyKey={key!} />
          </CardContent></Card>
        </>
      )}
      {!company && <p className="text-sm text-muted-foreground">Companies with finance data: {withReport} of {companies}</p>}
      <Card><CardHeader><CardTitle>Profit &amp; loss</CardTitle></CardHeader><CardContent>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Company</TableHead><TableHead>Sector</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Total cost</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Report</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {pnlAll.map((x) => {
            const { c } = x, head = (<><TableCell className="font-medium">{c.name}</TableCell><TableCell>{sectors.find(([k]) => k === c.sector)?.[1] ?? c.sector}</TableCell></>);
            if (x.kind === "none") return <TableRow key={`${c.id}-none`}>{head}<TableCell colSpan={6}><Badge className={tone.gray}>No P&amp;L data yet</Badge></TableCell></TableRow>;
            const r = x.r as ReturnType<typeof reportsFor>[number], rv = sum(r.revenue), nt = sum(r.net);
            return (
              <TableRow key={`${c.id}-pnl-${r.year}`}>
                {head}
                <TableCell>{MONTHS[0]}-{MONTHS[11]} {r.year}</TableCell>
                <TableCell className="text-right tabular-nums">{n(rv)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(sum(r.cost))}</TableCell>
                <TableCell className={`text-right tabular-nums ${neg(nt)}`}>{n(nt)}</TableCell>
                <TableCell className={`text-right tabular-nums ${neg(nt)}`}>{rv ? `${((nt / rv) * 100).toFixed(1)}%` : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={`/admin/finance?company=${c.id}&year=${r.year}`}>View</Link></Button>
                    <form action={deletePnlYear}>
                      <input type="hidden" name="key" value={keyFor(c)} />
                      <input type="hidden" name="year" value={r.year} />
                      <ConfirmButton variant="outline" size="sm" message={`Delete ${c.name}'s ${r.year} P&L statement? This cannot be undone.`}>Delete</ConfirmButton>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!pnlAll.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No companies yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Monthly sales</CardTitle></CardHeader><CardContent>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Company</TableHead><TableHead>Sector</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Report</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {salesAll.map((x) => {
            const { c } = x, head = (<><TableCell className="font-medium">{c.name}</TableCell><TableCell>{sectors.find(([k]) => k === c.sector)?.[1] ?? c.sector}</TableCell></>);
            if (x.kind === "none") return <TableRow key={`${c.id}-none`}>{head}<TableCell colSpan={3}><Badge className={tone.gray}>No monthly sales report yet</Badge></TableCell></TableRow>;
            const r = x.r as ReturnType<typeof salesFor>[number];
            return (
              <TableRow key={`${c.id}-sales-${r.year}`}>
                {head}
                <TableCell>{MONTHS[0]}-{MONTHS[11]} {r.year}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.room + r.other)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={`/admin/finance?company=${c.id}&sales=${r.year}`}>View</Link></Button>
                    <form action={deleteDailyYear}>
                      <input type="hidden" name="key" value={keyFor(c)} />
                      <input type="hidden" name="year" value={r.year} />
                      <ConfirmButton variant="outline" size="sm" message={`Delete ${c.name}'s ${r.year} monthly sales report? This cannot be undone.`}>Delete</ConfirmButton>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!salesAll.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No companies yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
      </CardContent></Card>
      {one && salesYear && (
        <AccountGrid title={`Monthly sales - ${salesYear}`} year={salesYear} rows={plRows(salesYear, key!, "sales")}
          onSave={saveSalesCell.bind(null, salesYear, key!)} />
      )}
      {!company && !!withData.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          {byYear.map(({ year, top }) => <Card key={year}><CardHeader><CardTitle>Cost breakdown - {year}</CardTitle></CardHeader><CardContent><HBars rows={top} /></CardContent></Card>)}
        </div>
      )}
      {edit && (
        <AccountGrid title={`P&L - ${edit}`} year={edit} rows={plRows(edit, key!)}
          onSave={savePnlCell.bind(null, edit, key!)} />
      )}
    </>
  );
}

/** Read-only monthly grid for one year, grouped by main account. Figures are edited one at a time via EditPnlFigure. Shared by P&L and monthly sales. */
function AccountGrid({ title, year, rows, onSave }: { title: string; year: number; rows: ReturnType<typeof plRows>; onSave: (main: string, sub: string, month: number, value: number) => Promise<void> }) {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.main, [...(groups.get(r.main) ?? []), r]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><EditPnlFigure year={year} months={MONTHS} accounts={rows} onSave={onSave} /></div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50 text-left"><th className="sticky left-0 z-10 min-w-56 bg-muted px-2 py-2">Account</th>{MONTHS.map((m) => <th key={m} className="px-1 py-2 text-right">{m}</th>)}<th className="px-2 py-2 text-right">Total</th></tr></thead>
          {[...groups].map(([main, rs]) => (
            <tbody key={main}>
              <tr className="bg-muted/40 font-semibold"><td className="sticky left-0 bg-muted px-2 py-1.5">{main}</td>{MONTHS.map((_, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums">{n(sum(rs.map((r) => r.m[i])))}</td>)}<td className="px-2 py-1.5 text-right tabular-nums">{n(sum(rs.flatMap((r) => r.m)))}</td></tr>
              {rs.map((r) => (
                <tr key={r.sub} className="border-t">
                  <td className="sticky left-0 bg-card px-2 py-1 pl-5">{r.sub}</td>
                  {r.m.map((v, i) => <td key={i} className={`px-2 py-1 text-right tabular-nums ${neg(v)}`}>{n(v)}</td>)}
                  <td className={`px-2 py-1 text-right tabular-nums ${neg(sum(r.m))}`}>{n(sum(r.m))}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
