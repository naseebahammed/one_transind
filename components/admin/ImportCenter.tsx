"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Landmark, Truck, Users } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { UploadBankPosition } from "@/components/admin/UploadBankPosition";
import { UploadBrandBudget } from "@/components/admin/UploadBrandBudget";
import { UploadEmployees } from "@/components/admin/UploadEmployees";
import { UploadPosReports } from "@/components/admin/UploadPosReports";
import { UploadProfitability } from "@/components/admin/UploadProfitability";
import { UploadReport } from "@/components/admin/UploadReport";
import { UploadSettlements } from "@/components/admin/UploadSettlements";
import { UploadSupplierAgeing } from "@/components/admin/UploadSupplierAgeing";

export type ImportCompany = {
  id: number;
  name: string;
  sector: string;
  sectorName: string;
};

type TabKey = "all" | "company" | "finance" | "operations" | "hr";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All imports" },
  { key: "company", label: "Company reports" },
  { key: "finance", label: "Finance & banking" },
  { key: "operations", label: "Retail & logistics" },
  { key: "hr", label: "HR & staff" },
];

export function ImportCenter({ companies }: { companies: ImportCompany[] }) {
  const [tab, setTab] = useState<TabKey>("all");
  const [companyId, setCompanyId] = useState<string>(companies[0] ? String(companies[0].id) : "");

  const selected = companies.find((c) => String(c.id) === companyId) ?? companies[0];
  const sectors = [...new Set(companies.map((c) => c.sectorName))].sort((a, b) => a.localeCompare(b));
  const show = (section: Exclude<TabKey, "all">) => tab === "all" || tab === section;

  return (
    <div className="space-y-6">
      <Card compact className="flex-row flex-wrap items-center gap-2 px-4">
        <span className="text-xs font-medium text-muted-foreground">Category</span>
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant={tab === t.key ? "secondary" : "outline"}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
          >
            {t.label}
          </Button>
        ))}
      </Card>

      {show("company") && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" aria-hidden="true" />
                <CardTitle>Company reports</CardTitle>
              </div>
              {selected && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/companies/${selected.id}`}>Open company page</Link>
                </Button>
              )}
            </div>
            <CardDescription>
              Upload P&amp;L, monthly sales, tenancy, daily sales deposits, COGS, or FMCG control workbooks for a specific company.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="import-company" className="text-sm font-medium">Company</label>
                  <NativeSelect
                    id="import-company"
                    value={String(selected.id)}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="min-w-64"
                  >
                    {sectors.map((sectorLabel) => (
                      <optgroup key={sectorLabel} label={sectorLabel}>
                        {companies
                          .filter((c) => c.sectorName === sectorLabel)
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </optgroup>
                    ))}
                  </NativeSelect>
                  <Badge variant="neutral">{selected.sectorName}</Badge>
                </div>
                <UploadReport key={selected.id} companyId={selected.id} sector={selected.sector} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active companies found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {show("finance") && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-primary" aria-hidden="true" />
              <CardTitle>Finance &amp; banking</CardTitle>
            </div>
            <CardDescription>Group-level payables, bank facilities, and annual brand budgets.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="space-y-2 pb-4">
              <div className="text-sm font-semibold">Supplier ageing (payables)</div>
              <UploadSupplierAgeing />
            </div>
            <div className="space-y-2 py-4">
              <div className="text-sm font-semibold">Bank position</div>
              <p className="text-xs text-muted-foreground">Upload a copy holding only the sheet with the current date.</p>
              <UploadBankPosition />
            </div>
            <div className="space-y-2 pt-4">
              <div className="text-sm font-semibold">Brand budget (Trading &amp; Distribution)</div>
              <UploadBrandBudget />
            </div>
          </CardContent>
        </Card>
      )}

      {show("operations") && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-primary" aria-hidden="true" />
              <CardTitle>Retail &amp; logistics</CardTitle>
            </div>
            <CardDescription>Point-of-sale monthly exports and logistics profitability workbooks.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="space-y-2 pb-4">
              <div className="text-sm font-semibold">Retail POS reports (Dukan, Top Perfumes: .xls monthly)</div>
              <UploadPosReports />
            </div>
            <div className="space-y-2 pt-4">
              <div className="text-sm font-semibold">Logistics profitability</div>
              <UploadProfitability />
            </div>
          </CardContent>
        </Card>
      )}

      {show("hr") && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden="true" />
              <CardTitle>HR &amp; staff</CardTitle>
            </div>
            <CardDescription>New-hires/leavers staff lists and employee settlement ledgers.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="space-y-2 pb-4">
              <div className="text-sm font-semibold">Staff lists (new hires &amp; leavers)</div>
              <UploadEmployees />
            </div>
            <div className="space-y-2 pt-4">
              <div className="text-sm font-semibold">Settlement payments</div>
              <p className="text-xs text-muted-foreground">Columns: UPLOAD DATE, EMP #, EMP NAME, DIVISION, SETTLEMENT TYPE, PAID AMOUNT.</p>
              <UploadSettlements />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
