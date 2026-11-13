"use client";

import { useState } from "react";
import { Download, Search, X } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { cn } from "@/lib/cn";

export type ActivityImportItem = {
  id: number;
  company: string;
  section: string;
  source: string;
  file_name: string;
  has_file: boolean;
  status: string;
  error: string | null;
  rows_loaded: number;
  period_from: string | null;
  period_to: string | null;
  created: string;
};

export type ActivityLogItem = {
  t: string;
  job: string;
  ok: boolean;
  n: number;
};

type ViewTab = "uploads" | "jobs";
type StatusFilter = "all" | "ok" | "failed";

export function ActivityLogView({
  imports,
  logs,
}: {
  imports: ActivityImportItem[];
  logs: ActivityLogItem[];
}) {
  const [tab, setTab] = useState<ViewTab>("uploads");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadedCount = imports.filter((r) => r.status === "loaded").length;
  const rejectedCount = imports.length - loadedCount;
  const failedJobsCount = logs.filter((l) => !l.ok).length;

  const companyOptions = [...new Set(imports.map((r) => r.company))].sort((a, b) => a.localeCompare(b));
  const needle = query.trim().toLowerCase();

  const filteredImports = imports.filter((r) => {
    if (companyFilter && r.company !== companyFilter) return false;
    if (statusFilter === "ok" && r.status !== "loaded") return false;
    if (statusFilter === "failed" && r.status === "loaded") return false;
    if (needle) {
      const hay = `${r.company} ${r.section} ${r.source} ${r.file_name} ${r.error ?? ""} ${r.period_from ?? ""} ${r.period_to ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const filteredLogs = logs.filter((l) => {
    if (statusFilter === "ok" && !l.ok) return false;
    if (statusFilter === "failed" && l.ok) return false;
    if (needle && !`${l.job} ${l.t}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const hasFilters = Boolean(needle || (tab === "uploads" && companyFilter) || statusFilter !== "all");

  const resetFilters = () => {
    setQuery("");
    setCompanyFilter("");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card compact className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => { setTab("uploads"); setStatusFilter("all"); }}>
          <CardContent>
            <div className="text-xs text-muted-foreground">Recent uploads</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">{imports.length}</div>
            <div className="text-xs text-muted-foreground">Last 100 file imports</div>
          </CardContent>
        </Card>
        <Card compact className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => { setTab("uploads"); setStatusFilter("ok"); }}>
          <CardContent>
            <div className="text-xs text-muted-foreground">Loaded cleanly</div>
            <div className="mt-0.5 text-2xl font-semibold text-success tabular-nums">{loadedCount}</div>
            <div className="text-xs text-muted-foreground">Accepted into database</div>
          </CardContent>
        </Card>
        <Card compact className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => { setTab("uploads"); setStatusFilter("failed"); }}>
          <CardContent>
            <div className="text-xs text-muted-foreground">Rejected uploads</div>
            <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", rejectedCount > 0 ? "text-destructive" : "text-muted-foreground")}>
              {rejectedCount}
            </div>
            <div className="text-xs text-muted-foreground">{rejectedCount > 0 ? "Click to inspect errors" : "Zero rejected files"}</div>
          </CardContent>
        </Card>
        <Card compact className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => { setTab("jobs"); setStatusFilter(failedJobsCount > 0 ? "failed" : "all"); }}>
          <CardContent>
            <div className="text-xs text-muted-foreground">System jobs &amp; edits</div>
            <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", failedJobsCount > 0 ? "text-destructive" : "text-foreground")}>
              {failedJobsCount > 0 ? `${failedJobsCount} failed` : logs.length}
            </div>
            <div className="text-xs text-muted-foreground">{failedJobsCount > 0 ? "Click to inspect failed jobs" : "All recent jobs succeeded"}</div>
          </CardContent>
        </Card>
      </div>

      <Card flush>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div role="tablist" aria-label="Activity view" className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "uploads"}
              onClick={() => setTab("uploads")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tab === "uploads" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Uploads <Badge variant="neutral">{imports.length}</Badge>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "jobs"}
              onClick={() => setTab("jobs")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tab === "jobs" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Jobs &amp; edits <Badge variant="neutral">{logs.length}</Badge>
            </button>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "uploads" ? "Search company, file, error…" : "Search job or timestamp…"}
              aria-label="Search activity"
              className="h-8 pr-8 pl-9"
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

          {tab === "uploads" && companyOptions.length > 0 && (
            <NativeSelect
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="Filter by company"
              className="h-8 max-w-52 bg-card"
            >
              <option value="">All companies</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          )}

          <div role="group" aria-label="Filter by status" className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {(
              [
                ["all", "All"],
                ["ok", tab === "uploads" ? "Loaded" : "OK"],
                ["failed", tab === "uploads" ? "Rejected" : "Failed"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  statusFilter === key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {tab === "uploads"
              ? `Showing ${filteredImports.length} of ${imports.length}`
              : `Showing ${filteredLogs.length} of ${logs.length}`}
          </span>
        </div>

        {tab === "uploads" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Report</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredImports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.created}</TableCell>
                  <TableCell className="font-medium">{r.company}</TableCell>
                  <TableCell>
                    <span>{r.section}</span>
                    {r.source !== "upload" && <span className="ml-1 text-xs text-muted-foreground">({r.source})</span>}
                  </TableCell>
                  <TableCell>
                    {r.has_file ? (
                      <a
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                        href={`/api/imports/${r.id}`}
                      >
                        <Download className="size-3.5 shrink-0" />
                        <span>{r.file_name}</span>
                      </a>
                    ) : (
                      r.file_name
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.period_from === r.period_to ? r.period_from ?? "—" : `${r.period_from} to ${r.period_to}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "loaded" ? "success" : "danger"}>
                      {r.status === "loaded" ? "Loaded" : "Rejected"}
                    </Badge>
                    {r.error && (
                      <p className="mt-1.5 max-w-md rounded-md bg-danger-soft/50 px-2.5 py-1 whitespace-normal text-xs text-danger-soft-foreground">
                        {r.error}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.rows_loaded}</TableCell>
                </TableRow>
              ))}
              {!filteredImports.length && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {imports.length ? "No uploads match the current filters." : "No uploads yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((l, i) => (
                <TableRow key={`${l.t}-${l.job}-${i}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.t}</TableCell>
                  <TableCell className="font-medium">{l.job}</TableCell>
                  <TableCell>
                    <Badge variant={l.ok ? "success" : "danger"}>{l.ok ? "OK" : "Failed"}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.n}</TableCell>
                </TableRow>
              ))}
              {!filteredLogs.length && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {logs.length ? "No jobs or edits match the current filters." : "No jobs or edits recorded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
