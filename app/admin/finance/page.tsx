import { SECTOR } from "@/lib/org";
import Link from "next/link";
import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { HBars } from "@/components/admin/FinanceCharts";
import { UploadReport } from "@/components/admin/UploadReport";
import { EditPnlFigure } from "@/components/admin/EditPnlFigure";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Trash2 } from "lucide-react";
import { Switch } from "@/components/admin/ui/switch";
import { deleteDailyYear, deletePnlYear, savePnlCell, saveSalesCell, saveUnitsCell } from "../al-manzil/actions";
import { toggleCompanyHidden } from "../companies/actions";
import { alManzilKey, keyFor, plRows, report, years, loadReports } from "@/lib/reports";
import { listCompanies, type Company } from "@/lib/companies";
import { listExpenses } from "@/lib/company-figures";
import { listSectors } from "@/lib/sectors";
import { link } from "@/lib/url";
import { fmt, MONTHS, sum } from "@/lib/format";

const neg = (v: number) => (v < 0 ? "text-destructive" : "");

/** Years on file for this company's P&L, each year's figures. Empty until a statement is uploaded for it. */
const reportsFor = (c: Company) => { const key = keyFor(c); return years(key).map((year) => { const r = report(year, key); return { year, revenue: r.revenue, cost: r.totalCost, net: r.net, costGroups: r.costGroups }; }); };

/** One row per year of the company's monthly sales grid (same shape as P&L), summed over the year. Empty until a report is uploaded. */
const salesFor = (c: Company) => {
  const key = keyFor(c);
  // Every REVENUE line counts: hotels split room/other revenue, other sectors (e.g. Pavati) have a single "Sales" line.
  return years(key, "sales").map((year) => ({ year, revenue: sum(plRows(year, key, "sales").filter((r) => r.main === "REVENUE").map((r) => sum(r.m))) }));
};

type Row = { c: Company; kind: "none" } | { c: Company; kind: "pnl"; r: ReturnType<typeof reportsFor>[number] } | { c: Company; kind: "sales"; r: ReturnType<typeof salesFor>[number] };

type Search = Promise<{ company?: string; year?: string; sales?: string; units?: string; showHidden?: string }>;

const HideToggle = ({ c }: { c: Company }) => (
  <form action={toggleCompanyHidden} className="flex justify-end">
    <input type="hidden" name="id" value={c.id} />
    <input type="hidden" name="hidden" value={c.hidden ? 0 : 1} />
    <Switch type="submit" checked={!c.hidden} aria-label={`${c.hidden ? "Show" : "Hide"} ${c.name}`} />
  </form>
);

export default function Finance({ searchParams }: { searchParams: Search }) {
  return <Page title="Company finance" description="Profit & loss summary for each company with a finance report."><Summary searchParams={searchParams} /></Page>;
}

async function Summary({ searchParams }: { searchParams: Search }) {
  await loadReports();
  const { company, year: yearParam, sales: salesParam, units: unitsParam } = await searchParams;
  const sectors = await listSectors();
  // Hidden companies stay in the tables (so they can be switched back on) but are left out of the charts.
  const rows = (await listCompanies()).filter((c) => !company || String(c.id) === company).flatMap((c) => { const reports = reportsFor(c); return (reports.length ? reports : [undefined]).map((r) => ({ c, r })); });
  const withData = rows.filter((x) => x.r);
  const companies = new Set(rows.map((x) => x.c.id)).size, withReport = new Set(withData.map((x) => x.c.id)).size;
  const visibleWithData = withData.filter((x) => !x.c.hidden);
  const byYear = [...new Set(visibleWithData.map((x) => x.r!.year))].sort().map((year) => {
    const totals = new Map<string, number>();
    for (const { r } of visibleWithData.filter((x) => x.r!.year === year))
      for (const [name, d] of r!.costGroups) totals.set(name, (totals.get(name) ?? 0) + sum(d));
    const top = [...totals].sort((a, b) => b[1] - a[1]); // all lines, so the percentages are shares of total cost
    return { year, top };
  });
  const one = company ? rows[0]?.c : undefined;
  const key = one && keyFor(one);
  const ys = key ? years(key) : [];
  const edit = one && yearParam && ys.includes(+yearParam) ? +yearParam : undefined; // the P&L table shows only after View (?year=) is clicked
  // View/Hide on a data row toggles that year's grid below; other open grids of the same company stay open.
  const open = (c: Company) => (one?.id === c.id ? { year: edit ? String(edit) : undefined, sales: salesYear ? String(salesYear) : undefined, units: unitsYear ? String(unitsYear) : undefined } : {});
  const toggle = (c: Company, param: "year" | "sales" | "units", y: number) => link("/admin/finance", { company: String(c.id), ...open(c), [param]: open(c)[param] === String(y) ? undefined : String(y) });
  const salesRows = [...new Map(rows.map((x) => [x.c.id, x.c])).values()].flatMap((c) => salesFor(c).map((r) => ({ c, r })));
  const salesYear = one && salesParam && salesRows.some((x) => x.c.id === one.id && x.r.year === +salesParam) ? +salesParam : undefined; // the sales grid shows only after View (?sales=) is clicked
  const unitYears = key ? years(key, "units") : [];
  const unitsYear = unitsParam && unitYears.includes(+unitsParam) ? +unitsParam : undefined; // the unit-type grid shows only after View (?units=) is clicked
  const uniqueCompanies = [...new Map(rows.map((x) => [x.c.id, x.c])).values()];
  const pnlAll: Row[] = uniqueCompanies.flatMap((c): Row[] => {
    const items: Row[] = rows.filter((x) => x.c.id === c.id && x.r).map((x) => ({ c, kind: "pnl" as const, r: x.r! }));
    return items.length ? items : [{ c, kind: "none" }];
  });
  const salesAll: Row[] = uniqueCompanies.flatMap((c): Row[] => {
    const items: Row[] = salesRows.filter((x) => x.c.id === c.id).map((x) => ({ c, kind: "sales" as const, r: x.r }));
    return items.length ? items : [{ c, kind: "none" }];
  });
  // Expenses: one row per company and year with data; a month without a row stays empty (not submitted).
  const expenses = await listExpenses();
  const expenseRows = uniqueCompanies.flatMap((c) => {
    const mine = expenses.filter((e) => e.company_id === c.id);
    return [...new Set(mine.map((e) => e.year))].sort().map((year) => ({ c, year, m: MONTHS.map((_, i) => mine.find((e) => e.year === year && e.month === i)?.value ?? null) }));
  });
  const qar = (v: number | null) => (v === null ? "—" : fmt(Math.abs(v), 2, 0));
  return (
    <>
      {one && (
        <Card className="gap-3 px-6 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
            <span className="flex items-center gap-2 font-semibold">{one.name}<Badge variant={one.active ? "success" : "neutral"}>{one.active ? "Active" : "Inactive"}</Badge></span>
            {([["Sector", sectors.find(([k]) => k === one.sector)?.[1] ?? one.sector]] as const).map(([l, v]) => (
              <span key={l}><span className="text-muted-foreground">{l}: </span><span className="font-medium">{v || "-"}</span></span>
            ))}
          </div>
          <UploadReport companyId={one.id} sector={one.sector} />
        </Card>
      )}
      {!company && (
        <p className="text-sm text-muted-foreground">
          Companies with finance data: {withReport} of {companies}
        </p>
      )}
      <Card className="gap-2 py-3"><CardHeader><CardTitle className="text-sm">Profit &amp; loss</CardTitle></CardHeader><CardContent>
      <Table>
        <TableHeader>
          <TableRow>{!one && <><TableHead>Company</TableHead><TableHead>Sector</TableHead></>}<TableHead>Period</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Total cost</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Report</TableHead>{!one && <TableHead className="text-right">Visible</TableHead>}</TableRow>
        </TableHeader>
        <TableBody>
          {pnlAll.map((x) => {
            const { c } = x, head = one ? null : (<><TableCell className="font-medium">{c.name}</TableCell><TableCell>{sectors.find(([k]) => k === c.sector)?.[1] ?? c.sector}</TableCell></>);
            if (x.kind === "none") return <TableRow key={`${c.id}-none`}>{head}<TableCell colSpan={6}><Badge variant="neutral">No P&amp;L data yet</Badge></TableCell>{!one && <TableCell className="text-right"><HideToggle c={c} /></TableCell>}</TableRow>;
            const r = x.r as ReturnType<typeof reportsFor>[number], rv = sum(r.revenue), nt = sum(r.net);
            return (
              <TableRow key={`${c.id}-pnl-${r.year}`}>
                {head}
                <TableCell>{MONTHS[0]}-{MONTHS[11]} {r.year}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(rv)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(sum(r.cost))}</TableCell>
                <TableCell className={`text-right tabular-nums ${neg(nt)}`}>{fmt(nt)}</TableCell>
                <TableCell className={`text-right tabular-nums ${neg(nt)}`}>{rv ? `${((nt / rv) * 100).toFixed(1)}%` : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={toggle(c, "year", r.year)}>{open(c).year === String(r.year) ? "Hide" : "View"}</Link></Button>
                    <form action={deletePnlYear}>
                      <input type="hidden" name="key" value={keyFor(c)} />
                      <input type="hidden" name="year" value={r.year} />
                      <ConfirmButton size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Delete ${r.year} P&L`} title="Delete" message={`Delete ${c.name}'s ${r.year} P&L statement? This cannot be undone.`}><Trash2 /></ConfirmButton>
                    </form>
                  </div>
                </TableCell>
                {!one && <TableCell className="text-right">{pnlAll.find((y) => y.c.id === c.id) === x && <HideToggle c={c} />}</TableCell>}
              </TableRow>
            );
          })}
          {!pnlAll.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No companies yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
      </CardContent></Card>
      {one && !one.hidden && edit && <GridSection title={`P&L - ${edit}`}><AccountGrid year={edit} rows={plRows(edit, key!)} onSave={savePnlCell.bind(null, edit, key!)} /></GridSection>}
      <Card className="gap-2 py-3"><CardHeader><CardTitle className="text-sm">Monthly sales</CardTitle></CardHeader><CardContent>
      <Table>
        <TableHeader>
          <TableRow>{!one && <><TableHead>Company</TableHead><TableHead>Sector</TableHead></>}<TableHead>Period</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Report</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {salesAll.map((x) => {
            const { c } = x, head = one ? null : (<><TableCell className="font-medium">{c.name}</TableCell><TableCell>{sectors.find(([k]) => k === c.sector)?.[1] ?? c.sector}</TableCell></>);
            if (x.kind === "none") return <TableRow key={`${c.id}-none`}>{head}<TableCell colSpan={3}><Badge variant="neutral">No monthly sales report yet</Badge></TableCell></TableRow>;
            const r = x.r as ReturnType<typeof salesFor>[number];
            return (
              <TableRow key={`${c.id}-sales-${r.year}`}>
                {head}
                <TableCell>{MONTHS[0]}-{MONTHS[11]} {r.year}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.revenue)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={toggle(c, "sales", r.year)}>{open(c).sales === String(r.year) ? "Hide" : "View"}</Link></Button>
                    <form action={deleteDailyYear}>
                      <input type="hidden" name="key" value={keyFor(c)} />
                      <input type="hidden" name="year" value={r.year} />
                      <ConfirmButton size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Delete ${r.year} monthly sales`} title="Delete" message={`Delete ${c.name}'s ${r.year} monthly sales report? This cannot be undone.`}><Trash2 /></ConfirmButton>
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
      {one && !one.hidden && salesYear && <GridSection title={`Monthly sales - ${salesYear}`}><AccountGrid year={salesYear} rows={plRows(salesYear, key!, "sales")} onSave={one.sector === SECTOR.realEstate ? undefined : saveSalesCell.bind(null, salesYear, key!)} /></GridSection>}
      <Card className="gap-2 py-3"><CardHeader><CardTitle className="text-sm">Expenses (QAR)</CardTitle></CardHeader><CardContent>
      <Table>
        <TableHeader>
          <TableRow>{!one && <TableHead>Company</TableHead>}<TableHead>Year</TableHead>{MONTHS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {expenseRows.map(({ c, year, m }) => (
            <TableRow key={`${c.id}-exp-${year}`}>
              {!one && <TableCell className="font-medium">{c.name}</TableCell>}
              <TableCell>{year}</TableCell>
              {m.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{qar(v)}</TableCell>)}
              <TableCell className="text-right font-semibold tabular-nums">{qar(sum(m.map((v) => v ?? 0)))}</TableCell>
            </TableRow>
          ))}
          {!expenseRows.length && <TableRow><TableCell colSpan={15} className="text-muted-foreground"><Badge variant="neutral">No expenses yet</Badge></TableCell></TableRow>}
        </TableBody>
      </Table>
      </CardContent></Card>
      {one && !one.hidden && !!unitYears.length && (
        <Card><CardHeader><CardTitle>Sales by unit type</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
          {unitYears.map((y) => <Button key={y} asChild variant={y === unitsYear ? "secondary" : "outline"} size="sm"><Link href={toggle(one, "units", y)}>{y === unitsYear ? "Hide" : "View"} {y}</Link></Button>)}
        </CardContent></Card>
      )}
      {one && !one.hidden && unitsYear && <GridSection title={`Sales by unit type - ${unitsYear}`}><AccountGrid year={unitsYear} rows={plRows(unitsYear, key!, "units")} onSave={saveUnitsCell.bind(null, unitsYear, key!)} /></GridSection>}
      {!company && !!withData.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          {byYear.map(({ year, top }) => <Card key={year}><CardHeader><CardTitle>Cost breakdown - {year}</CardTitle></CardHeader><CardContent><HBars rows={top} /></CardContent></Card>)}
        </div>
      )}
    </>
  );
}

const GridSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3"><h2 className="text-sm font-semibold">{title}</h2>{children}</section>
);

/** Read-only monthly grid for one year, grouped by main account. Figures are edited one at a time via EditPnlFigure. Shared by P&L and monthly sales. */
function AccountGrid({ year, rows, onSave }: { year: number; rows: ReturnType<typeof plRows>; onSave?: (main: string, sub: string, month: number, value: number) => Promise<void> }) {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.main, [...(groups.get(r.main) ?? []), r]);
  return (
    <div className="space-y-3">
      {onSave ? <div className="flex justify-end"><EditPnlFigure year={year} months={MONTHS} accounts={rows} onSave={onSave} /></div> : <p className="text-xs text-muted-foreground">Calculated from the daily sales report. To correct a figure, upload the corrected days.</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50 text-left"><th className="sticky left-0 z-10 min-w-56 bg-muted px-2 py-2">Account</th>{MONTHS.map((m) => <th key={m} className="px-1 py-2 text-right">{m}</th>)}<th className="px-2 py-2 text-right">Total</th></tr></thead>
          {[...groups].map(([main, groupRows]) => (
            <tbody key={main}>
              <tr className="bg-muted/40 font-semibold"><td className="sticky left-0 bg-muted px-2 py-1.5">{main}</td>{MONTHS.map((_, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums">{fmt(sum(groupRows.map((r) => r.m[i])))}</td>)}<td className="px-2 py-1.5 text-right tabular-nums">{fmt(sum(groupRows.flatMap((r) => r.m)))}</td></tr>
              {groupRows.map((r) => (
                <tr key={r.sub} className="border-t">
                  <td className="sticky left-0 bg-card px-2 py-1 pl-5">{r.sub}</td>
                  {r.m.map((v, i) => <td key={i} className={`px-2 py-1 text-right tabular-nums ${neg(v)}`}>{fmt(v)}</td>)}
                  <td className={`px-2 py-1 text-right tabular-nums ${neg(sum(r.m))}`}>{fmt(sum(r.m))}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
