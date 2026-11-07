"use client";
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
  sales: { label: "Monthly sales", accept: ".xlsx,.csv", hint: "The downloaded template, as Excel or CSV, one sales figure per month. Months you fill in replace the same months on file." },
} as const;
const FOR_REAL_ESTATE = ["pnl", "daily", "units"], FOR_OTHERS = ["pnl", "sales"];

export function UploadReport({ companyId, sector }: { companyId: number; sector: string }) {
  const [s, act, pending] = useActionState<UploadState, FormData>(uploadReport, {});
  const [type, setType] = useState<keyof typeof TYPES>("pnl");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const template = `/api/companies/${companyId}/template?${new URLSearchParams({ section: type, ...(month && type !== "sales" && { month }), ...(/^\d{4}$/.test(year) && { year }) })}`;
  // Submit by hand: React's automatic reset after a form action puts the report select back on its first option, and the next file would load as the wrong type.
  return (
    <form action={act} className="space-y-1" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => act(data)); }}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="companyId" value={companyId} />
        <NativeSelect name="type" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPES)}>
          {Object.entries(TYPES).filter(([k]) => (sector === "re" ? FOR_REAL_ESTATE : FOR_OTHERS).includes(k)).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </NativeSelect>
        {type !== "sales" && <NativeSelect aria-label="Template month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Last month</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </NativeSelect>}
        <Input type="number" name="year" placeholder="Year" title="Template year. Also used for a P&L file with no year in its headers." className="w-24" value={year} onChange={(e) => setYear(e.target.value)} />
        <Button asChild variant="outline"><a href={template}>Download template</a></Button>
        <input key={type} type="file" name="file" accept={TYPES[type].accept} required className="text-sm" />
        <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
        {s.error && <span className="text-sm text-destructive">{s.error}</span>}
        {s.ok && <span className="text-sm text-success">{s.ok}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{TYPES[type].hint}</p>
    </form>
  );
}
