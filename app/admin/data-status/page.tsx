import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { Page } from "@/components/admin/Page";
import { PrintButton } from "@/components/admin/PrintButton";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listCompanies, type Company } from "@/lib/companies";
import { monthStatuses, type FigureSection } from "@/lib/company-data";
import { listAllFilledMonths } from "@/lib/company-figures";
import { listUploadMonths, UPLOADS } from "@/lib/upload-months";
import { link } from "@/lib/url";

type Search = Promise<{ year?: string }>;
// ok: complete, part: some months missing, none: nothing on file, na: not required for this company.
type Cell = { state: "ok" | "part" | "none" | "na"; text?: string };

const na: Cell = { state: "na" };
const yes = (v: boolean): Cell => ({ state: v ? "ok" : "none" });

// Mandatory profile items.
const PROFILE: { key: string; label: string; check: (c: Company) => Cell }[] = [
  { key: "type", label: "Company type", check: (c) => yes(!!c.property_type) },
];
const MONTHLY: [string, string][] = [["pnl", "P&L"], ["budget", "Budget"], ["people", "People"], ["expenses", "Expenses"]];

/** Done out of due months; not required when nothing is due. */
const tally = (s: string[]): Cell => {
  const due = s.filter((x) => x !== "Not due").length, done = s.filter((x) => x === "Submitted").length;
  return due ? { state: done === due ? "ok" : done ? "part" : "none", text: `${done}/${due}` } : na;
};

const STYLE = { ok: "text-emerald-600", part: "text-amber-600", none: "text-red-600", na: "text-muted-foreground" };

export default function DataStatus({ searchParams }: { searchParams: Search }) {
  return (
    <Page title="Data status" description="What each company must provide, and what has been added so far." action={<PrintButton />}>
      <Matrix searchParams={searchParams} />
    </Page>
  );
}

async function Matrix({ searchParams }: { searchParams: Search }) {
  const today = new Date(), thisYear = today.getFullYear(), years = [thisYear - 2, thisYear - 1, thisYear];
  const raw = Number((await searchParams).year), year = years.includes(raw) ? raw : thisYear;
  const [allCompanies, filledFor, uploadsFor] = await Promise.all([listCompanies(), listAllFilledMonths(year), listUploadMonths(year)]);
  const companies = allCompanies.filter((c) => c.active && !c.hidden);
  const rows = companies.map((c) => {
    const filled = filledFor(c.id);
    const monthly = MONTHLY.map(([k]) => tally(monthStatuses(k as "pnl" | FigureSection, year, filled[k as FigureSection | "pnl"], today)));
    // Uploads a company has never used are not required of it.
    const uploads = UPLOADS.map(([k]) => { const months = uploadsFor(c.id, k); return months ? tally(monthStatuses("pnl", year, months, today)) : na; });
    return { c, cells: [...PROFILE.map((p) => p.check(c)), ...monthly, ...uploads] };
  });
  const columns: { label: string; section?: string }[] = [
    ...PROFILE.map((p) => ({ label: p.label, section: "profile" })),
    ...MONTHLY.map(([k, label]) => ({ label, section: k })),
    ...UPLOADS.map(([k, label]) => ({ label, section: k === "receipts" ? "daily" : undefined })), // the company page shows takings under "daily"; the rest have no tab there
  ];
  return (
    <>
      <Card className="flex-row flex-wrap items-center gap-2 px-6 py-2 text-sm">
        <span className="text-muted-foreground">Monthly data for</span>
        {years.map((y) => (
          <Button key={y} asChild size="sm" variant={y === year ? "secondary" : "outline"}>
            <Link href={link("/admin/data-status", { year: String(y) })} aria-current={y === year ? "page" : undefined}>{y}</Link>
          </Button>
        ))}
        <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Check className="size-3.5 text-emerald-600" />Complete</span>
          <span className="flex items-center gap-1"><span className="font-medium text-amber-600">n/m</span>Some months</span>
          <span className="flex items-center gap-1"><X className="size-3.5 text-red-600" />Missing</span>
          <span className="flex items-center gap-1"><Minus className="size-3.5" />Not required</span>
        </span>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            {columns.map((col) => <TableHead key={col.label} className="text-center">{col.label}</TableHead>)}
            <TableHead className="text-right">Complete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ c, cells }) => {
            const need = cells.filter((x) => x.state !== "na"), done = need.filter((x) => x.state === "ok").length;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium"><Link href={`/admin/companies/${c.id}`} className="hover:underline">{c.name}</Link></TableCell>
                {cells.map((x, i) => (
                  <TableCell key={columns[i].label} className="text-center">
                    <Link href={link(`/admin/companies/${c.id}`, { section: columns[i].section, year: columns[i].section === "profile" ? undefined : String(year) })}
                      className={`inline-flex items-center justify-center ${STYLE[x.state]}`} aria-label={`${c.name}, ${columns[i].label}: ${x.state === "ok" ? "complete" : x.state === "na" ? "not required" : x.text ?? "missing"}`}>
                      {x.state === "ok" ? <Check className="size-4" /> : x.state === "none" ? <X className="size-4" /> : x.state === "na" ? <Minus className="size-4" /> : <span className="text-xs font-medium tabular-nums">{x.text}</span>}
                    </Link>
                  </TableCell>
                ))}
                <TableCell className={`text-right tabular-nums ${done === need.length ? "text-emerald-600" : ""}`}>{done}/{need.length}</TableCell>
              </TableRow>
            );
          })}
          {!rows.length && <TableRow><TableCell colSpan={columns.length + 2} className="h-24 text-center text-muted-foreground">No active companies yet.</TableCell></TableRow>}
        </TableBody>
        {!!rows.length && (
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Companies complete</TableCell>
              {columns.map((col, i) => {
                const need = rows.filter((r) => r.cells[i].state !== "na");
                return <TableCell key={col.label} className="text-center text-xs tabular-nums">{need.length ? `${need.filter((r) => r.cells[i].state === "ok").length}/${need.length}` : "-"}</TableCell>;
              })}
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </>
  );
}
