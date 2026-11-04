import Link from "next/link";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { SECTIONS, type MonthStatus, type Section } from "@/lib/company-data";
import { link } from "@/lib/url";

/** Submitted months against months due, e.g. "9/10". */
export const progress = (s: MonthStatus[]) => `${s.filter((x) => x === "Submitted").length}/${s.filter((x) => x !== "Not due").length}`;

export const StatusBadge = ({ status }: { status: MonthStatus }) => (
  <Badge variant={status === "Submitted" ? "success" : status === "Not submitted" ? "destructive" : "neutral"}>{status}</Badge>
);

export function CompanySectionNav({ id, section, year, labels }: { id: number; section: Section; year: number; labels: Record<Section, string> }) {
  return (
    <nav aria-label="Company sections" className="flex flex-wrap gap-2">
      {SECTIONS.map(([k, name]) => (
        <Button key={k} asChild size="sm" variant={k === section ? "secondary" : "outline"}>
          <Link href={link(`/admin/companies/${id}`, { section: k, year: String(year) })} aria-current={k === section ? "page" : undefined}>
            {name} <span className="text-xs text-muted-foreground">{labels[k]}</span>
          </Link>
        </Button>
      ))}
    </nav>
  );
}

export function YearLinks({ id, section, year, years }: { id: number; section: Section; year: number; years: number[] }) {
  return (
    <Card className="flex-row flex-wrap items-center gap-2 px-6 py-2 text-sm">
      <span className="text-muted-foreground">Year</span>
      {years.map((y) => (
        <Button key={y} asChild size="sm" variant={y === year ? "secondary" : "outline"}>
          <Link href={link(`/admin/companies/${id}`, { section, year: String(y) })} aria-current={y === year ? "page" : undefined}>{y}</Link>
        </Button>
      ))}
    </Card>
  );
}
