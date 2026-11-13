"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

const NAMES: Record<string, string> = {
  admin: "Admin",
  companies: "Companies",
  accounts: "Chart of accounts",
  "data-status": "Data status",
  "manual-entry": "Manual data entry",
  sectors: "Sectors",
  "company-types": "Company types",
  "sales-sectors": "Sales sectors",
  employees: "Staff lists",
  finance: "Finance overview",
  "al-manzil": "Al Manzil 2024 vs 2025",
  activity: "Activity log",
  users: "Users",
  new: "New company",
};

const SECTION_LABELS: Record<string, string> = {
  pnl: "P&L",
  budget: "Budget",
  people: "People",
  expenses: "Expenses",
  daily: "Daily sales",
};

function CrumbBar({ crumbs }: { crumbs: { href: string; name: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={`${c.href}-${i}`} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
          {i === crumbs.length - 1 ? (
            <span className="truncate font-medium text-foreground">{c.name}</span>
          ) : (
            <Link href={c.href} className="truncate transition-colors hover:text-foreground">
              {c.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function buildBaseCrumbs(
  parts: string[],
  companyMap?: Map<string, string>,
  sectorMap?: Map<string, string>,
): { href: string; name: string }[] {
  return parts.map((part, i) => {
    const rawHref = "/" + parts.slice(0, i + 1).join("/");
    const href = rawHref === "/admin" ? "/admin/companies" : rawHref;
    const prev = parts[i - 1];
    let name = NAMES[part];
    if (!name) {
      if (prev === "companies") {
        name = companyMap?.get(part) ?? "Edit company";
      } else if (prev === "sectors") {
        const decoded = decodeURIComponent(part);
        name = sectorMap?.get(decoded) ?? decoded;
      } else {
        name = "Edit";
      }
    }
    return { href, name };
  });
}

/** Prerender-safe breadcrumb fallback (does not read searchParams). */
export function BreadcrumbsFallback() {
  const parts = usePathname().split("/").filter(Boolean);
  return <CrumbBar crumbs={buildBaseCrumbs(parts)} />;
}

export function Breadcrumbs({
  companies = [],
  sectors = [],
}: {
  companies?: [string, string][];
  sectors?: [string, string][];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parts = pathname.split("/").filter(Boolean);
  const companyMap = new Map(companies);
  const sectorMap = new Map(sectors);
  const crumbs = buildBaseCrumbs(parts, companyMap, sectorMap);

  // /admin/finance?company=12 -> Admin > Finance overview > Company Name
  const financeCompanyId = pathname === "/admin/finance" ? searchParams.get("company") : null;
  if (financeCompanyId) {
    const companyName = companyMap.get(financeCompanyId);
    if (companyName) {
      crumbs.push({ href: `/admin/finance?company=${financeCompanyId}`, name: companyName });
    }
  }

  // /admin/companies/12?section=pnl -> Admin > Companies > Company Name > P&L
  const sectionKey = parts[0] === "admin" && parts[1] === "companies" && parts[2] && parts[2] !== "new" ? searchParams.get("section") : null;
  if (sectionKey && SECTION_LABELS[sectionKey]) {
    crumbs.push({
      href: `${pathname}?section=${sectionKey}`,
      name: SECTION_LABELS[sectionKey],
    });
  }

  return <CrumbBar crumbs={crumbs} />;
}
