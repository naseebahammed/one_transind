import { SECTOR } from "@/lib/org";
import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { Page } from "@/components/admin/Page";
import { PrintButton } from "@/components/admin/PrintButton";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { loadReports } from "@/lib/al-manzil";
import { listCompanies, type Company } from "@/lib/companies";
import { monthStatuses, type FigureSection } from "@/lib/company-data";
import { listFilledMonths } from "@/lib/company-figures";
import { link } from "@/lib/url";

type Search = Promise<{ year?: string }>;
// ok: complete, part: some months missing, none: nothing on file, na: not required for this company.
type Cell = { state: "ok" | "part" | "none" | "na"; text?: string };

const na: Cell = { state: "na" };
const yes = (v: boolean): Cell => ({ state: v ? "ok" : "none" });
const realEstate = (c: Company) => c.sector === SECTOR.realEstate;

// Mandatory profile items. Rooms and types only apply to real estate, mirroring the profile form.
const PROFILE: { key: string; label: string; check: (c: Company) => Cell }[] = [
  { key: "logo", label: "Logo", check: (c) => yes(c.has_logo) },
  { key: "erp", label: "ERP code", check: (c) => yes(!!c.erp_code) },
  { key: "type", label: "Company type", check: (c) => (realEstate(c) ? yes(!!c.property_type) : na) },
  { key: "rooms", label: "Total rooms", check: (c) => (realEstate(c) ? yes(c.total_rooms > 0) : na) },
  { key: "inventory", label: "Room types", check: (c) => (realEstate(c) ? yes(c.room_types.length > 0) : na) },
];
const MONTHLY: [string, string][] = [["pnl", "P&L"], ["balance", "Balance sheet"], ["budget", "Budget"], ["people", "People"], ["expenses", "Expenses"]];

const STYLE = { ok: "text-emerald-600", part: "text-amber-600", none: "text-red-600", na: "text-muted-foreground" };

export default function DataStatus({ searchParams }: { searchParams: Search }) {
  return (
    <Page title="Data status" description="What each company must provide, and what has been added so far." action={<PrintButton />}>
      <Matrix searchParams={searchParams} />
    </Page>
  );
}

async function Matrix({ searchParams }: { searchParams: Search }) {
  await loadReports();
  const today = new Date(), thisYear = today.getFullYear(), years = [thisYear - 2, thisYear - 1, thisYear];
  const raw = Number((await searchParams).year), year = years.includes(raw) ? raw : thisYear;
  const companies = (await listCompanies()).filter((c) => c.active && !c.hidden);
  const filled = await Promise.all(companies.map((c) => listFilledMonths(c.id, year)));
  const rows = companies.map((c, i) => {
    const monthly = MONTHLY.map(([k]): Cell => {
      const s = monthStatuses(k as "pnl" | FigureSection, year, filled[i][k as FigureSection | "pnl"], today);
      const due = s.filter((x) => x !== "Not due").length, done = s.filter((x) => x === "Submitted").length;
      if (!due) return na;
      return { state: done === due ? "ok" : done ? "part" : "none", text: `${done}/${due}` };
    });
    return { c, cells: [...PROFILE.map((p) => p.check(c)), ...monthly] };
  });
  const columns = [...PROFILE.map((p) => ({ label: p.label, section: "profile" })), ...MONTHLY.map(([k, label]) => ({ label, section: k }))];
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
