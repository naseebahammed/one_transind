"use client";
import { SECTOR } from "@/lib/org";
import { startTransition, useActionState, useState } from "react";
import { uploadReport, type UploadState } from "@/app/admin/al-manzil/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { MONTHS } from "@/lib/company-data";

const TYPES = {
  pnl: { label: "P&L", accept: ".xlsx,.csv", hint: "Excel or CSV with month columns; in Excel, the first visible sheet. Months with figures in the file replace that month on file; empty months are left alone. Every account must be in the Chart of accounts." },
  daily: { label: "Monthly sales report", accept: ".csv,.xlsx", hint: "Excel or CSV with the columns of the downloaded template. Days in the file replace the same days." },
  units: { label: "1 BHK / 2 BHK report", accept: ".xlsx,.csv", hint: "Excel or CSV sales report split by unit type (availability, long/short stay, revenue per unit type). Months in the file replace the same months on file." },
  receipts: { label: "Daily sales deposit", accept: ".xlsx", hint: "The branch's Daily Sales Deposit workbook, all months. Pick the branch first. Days in the file replace the same days; days after the last figure are ignored." },
  cogs: { label: "COGS summary", accept: ".xlsx", hint: "The group Restaurants COGS Summary workbook. Only this company's columns are loaded, so upload it once on each company. Months in the file replace the same months on file." },
  dukan: { label: "Dukan Food monthly sales", accept: ".xlsx", hint: "DUKAN-TOTAL for the month, re-saved from .xls as .xlsx. Pick the branch first. The month in the file replaces the same month on file." },
  masters: { label: "FMCG reference data", accept: ".xlsx", hint: "The Market Audit (salesmen, customers), Stock Report (items, brands) or Daily Sales Report (monthly targets) workbook. Existing records are updated, never removed. A month's targets replace that month." },
  balances: { label: "FMCG stock and control reports", accept: ".xlsx", hint: "The daily Stock Report (keep the date in the file name, like 08-11-2026), Variance, Consignment or Ageing workbook. Each day is kept; uploading the same day again replaces it." },
  sales: { label: "Monthly sales", accept: ".xlsx,.csv", hint: "The downloaded template, as Excel or CSV, one sales figure per month. Months you fill in replace the same months on file." },
} as const;
const FOR_REAL_ESTATE = ["pnl", "daily", "units"], FOR_FOOD_BEVERAGE = ["pnl", "receipts", "cogs"], FOR_RETAIL = ["pnl", "sales", "dukan"], FOR_FMCG = ["pnl", "sales", "masters", "balances"], NO_TEMPLATE: string[] = ["receipts", "cogs", "dukan", "masters", "balances"], FOR_OTHERS = ["pnl", "sales"];

export function UploadReport({ companyId, sector, branchId, initialType = "pnl" }: { companyId: number; sector: string; branchId?: number | null; initialType?: keyof typeof TYPES }) {
  const [s, act, pending] = useActionState<UploadState, FormData>(uploadReport, {});
  const [type, setType] = useState<keyof typeof TYPES>(initialType);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const template = `/api/companies/${companyId}/template?${new URLSearchParams({ section: type, ...(month && type !== "sales" && { month }), ...(/^\d{4}$/.test(year) && { year }) })}`;
  // Submit by hand: React's automatic reset after a form action puts the report select back on its first option, and the next file would load as the wrong type.
  return (
    <form action={act} className="space-y-1" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => act(data)); }}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="branchId" value={branchId ?? ""} />
        <NativeSelect name="type" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPES)}>
          {Object.entries(TYPES).filter(([k]) => (sector === SECTOR.realEstate ? FOR_REAL_ESTATE : sector === SECTOR.foodBeverage ? FOR_FOOD_BEVERAGE : sector === SECTOR.retail ? FOR_RETAIL : sector === SECTOR.fmcg || sector === SECTOR.trading ? FOR_FMCG : FOR_OTHERS).includes(k)).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </NativeSelect>
        {type !== "sales" && !NO_TEMPLATE.includes(type) && <NativeSelect aria-label="Template month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Last month</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </NativeSelect>}
        {!NO_TEMPLATE.includes(type) && <Input type="number" name="year" placeholder="Year" title="Template year. Also used for a P&L file with no year in its headers." className="w-24" value={year} onChange={(e) => setYear(e.target.value)} />}
        {!NO_TEMPLATE.includes(type) && <Button asChild variant="outline"><a href={template}>Download template</a></Button>}
        <input key={type} type="file" name="file" accept={TYPES[type].accept} required className="text-sm" />
        <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
        {s.error && <span className="text-sm text-destructive">{s.error}</span>}
        {s.ok && <span className="text-sm text-success">{s.ok}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{TYPES[type].hint}</p>
    </form>
  );
}
