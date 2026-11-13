import Link from "next/link";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Separator } from "@/components/admin/ui/separator";
import { cn } from "@/lib/cn";
import { SECTIONS, type MonthStatus, type Section } from "@/lib/company-data";
import { link } from "@/lib/url";

/** Submitted months against months due, e.g. "9/10". */
export const progress = (s: MonthStatus[]) => `${s.filter((x) => x === "Submitted").length}/${s.filter((x) => x !== "Not due").length}`;

export const StatusBadge = ({ status }: { status: MonthStatus }) => (
  <Badge variant={status === "Submitted" ? "success" : status === "Not submitted" ? "danger" : "neutral"}>{status}</Badge>
);

function sectionBadgeVariant(label: string): "success" | "warning" | "danger" | "neutral" {
  if (!label) return "neutral";
  if (label === "Complete") return "success";
  if (label.endsWith("blank")) return "warning";
  const ratio = /^(\d+)\/(\d+)$/.exec(label);
  if (ratio) {
    const done = Number(ratio[1]);
    const due = Number(ratio[2]);
    if (due === 0) return "neutral";
    if (done >= due) return "success";
    if (done > 0) return "warning";
    return "danger";
  }
  return "neutral";
}

export function CompanySectionNav({
  id,
  section,
  year,
  labels,
  branchId,
  hidden = [],
  embedded = false,
}: {
  id: number;
  section: Section;
  year: number;
  labels: Record<Section, string>;
  branchId: number | null;
  hidden?: Section[];
  embedded?: boolean;
}) {
  return (
    <nav
      aria-label="Company sections"
      className={cn(
        "flex items-center gap-1 overflow-x-auto px-4",
        !embedded && "rounded-xl border bg-card shadow-xs",
      )}
    >
      {SECTIONS.filter(([k]) => !hidden.includes(k)).map(([k, name]) => {
        const active = k === section;
        const label = labels[k];
        return (
          <Link
            key={k}
            href={link(`/admin/companies/${id}`, { section: k, year: String(year), branch: branchId ? String(branchId) : undefined })}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <span>{name}</span>
            {label && <Badge variant={sectionBadgeVariant(label)}>{label}</Badge>}
          </Link>
        );
      })}
    </nav>
  );
}

function SegmentedLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** Unified compact scope bar combining Year and optional Branch selection in one row. */
export function CompanyScopeBar({
  id,
  section,
  year,
  years,
  branches = [],
  branchId,
}: {
  id: number;
  section: Section;
  year: number;
  years: number[];
  branches?: { id: number; name: string }[];
  branchId: number | null;
}) {
  return (
    <Card className="flex-row flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm shadow-xs">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Year</span>
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {years.map((y) => (
            <SegmentedLink
              key={y}
              href={link(`/admin/companies/${id}`, { section, year: String(y), branch: branchId ? String(branchId) : undefined })}
              active={y === year}
            >
              {y}
            </SegmentedLink>
          ))}
        </div>
      </div>

      {branches.length > 0 && (
        <>
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Scope</span>
            <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {[{ id: null, name: "Whole company" }, ...branches].map((b) => (
                <SegmentedLink
                  key={b.id ?? "company"}
                  href={link(`/admin/companies/${id}`, { section, year: String(year), branch: b.id ? String(b.id) : undefined })}
                  active={b.id === branchId}
                >
                  {b.name}
                </SegmentedLink>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function YearLinks({ id, section, year, years, branchId }: { id: number; section: Section; year: number; years: number[]; branchId: number | null }) {
  return <CompanyScopeBar id={id} section={section} year={year} years={years} branchId={branchId} />;
}

export function BranchLinks({ id, section, year, branches, branchId }: { id: number; section: Section; year: number; branches: { id: number; name: string }[]; branchId: number | null }) {
  return <CompanyScopeBar id={id} section={section} year={year} years={[year]} branches={branches} branchId={branchId} />;
}
