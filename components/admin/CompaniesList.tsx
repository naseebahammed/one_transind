"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { CompanyRow } from "@/components/admin/CompanyRow";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { cn } from "@/lib/cn";
import type { Company } from "@/lib/companies";

type StatusFilter = "all" | "active" | "inactive";

export function CompaniesList({
  companies,
  sectors,
  propertyTypes,
  initialQuery = "",
  initialSector = "",
  initialStatus = "all",
}: {
  companies: Company[];
  sectors: [string, string][];
  propertyTypes: [string, string][];
  initialQuery?: string;
  initialSector?: string;
  initialStatus?: StatusFilter;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sector, setSector] = useState(initialSector);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);

  const sectorNames = new Map(sectors);
  const typeNames = new Map(propertyTypes);
  const needle = query.trim().toLowerCase();

  const matchesQueryAndSector = companies.filter((c) => {
    if (sector && c.sector !== sector) return false;
    if (needle && !c.name.toLowerCase().includes(needle) && !(c.erp_code ?? "").toLowerCase().includes(needle)) return false;
    return true;
  });

  const activeCount = matchesQueryAndSector.filter((c) => !!c.active).length;
  const inactiveCount = matchesQueryAndSector.length - activeCount;

  const shown = matchesQueryAndSector.filter((c) => {
    if (status === "active") return !!c.active;
    if (status === "inactive") return !c.active;
    return true;
  });

  const filtered = Boolean(needle || sector || status !== "all");

  const clearFilters = () => {
    setQuery("");
    setSector("");
    setStatus("all");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or ERP code"
            aria-label="Search companies"
            className="pr-8 pl-9"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <NativeSelect
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Filter by sector"
          className="min-w-44 bg-card"
        >
          <option value="">All sectors</option>
          {sectors.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>

        <div role="group" aria-label="Filter by status" className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(
            [
              ["all", `All (${matchesQueryAndSector.length})`],
              ["active", `Active (${activeCount})`],
              ["inactive", `Inactive (${inactiveCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              aria-pressed={status === key}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                status === key
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Reset
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered
            ? `Showing ${shown.length} of ${companies.length}`
            : `${companies.length} ${companies.length === 1 ? "company" : "companies"}`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="admin-sticky-col">Name</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((c) => (
            <CompanyRow
              key={c.id}
              company={c}
              sectorLabel={sectorNames.get(c.sector) ?? c.sector}
              propertyTypeLabel={typeNames.get(c.property_type)}
            />
          ))}
          {!shown.length && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                {companies.length
                  ? "No companies match the current filters."
                  : "No companies yet. Click Add company to create the first one."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

