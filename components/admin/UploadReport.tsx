"use client";
import { useActionState, useState } from "react";
import { uploadReport, type UploadState } from "@/app/admin/al-manzil/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";

const TYPES = {
  pnl: { label: "P&L", accept: ".xlsx", hint: "Excel workbook, first visible sheet with month columns. Months (and years, when the headers carry them) in the file replace existing figures." },
  daily: { label: "Monthly sales report", accept: ".csv,.xlsx", hint: "CSV or Excel with the daily report columns (date, long/short stay guests and rates, rooms, revenue, occupancy). Days in the file replace the same days." },
  units: { label: "1 BHK / 2 BHK report", accept: ".xlsx", hint: "Excel sales report split by unit type (availability, long/short stay, revenue per unit type). Months in the file replace the same months on file." },
} as const;

export function UploadReport({ companyKey }: { companyKey: string }) {
  const [s, act, pending] = useActionState<UploadState, FormData>(uploadReport, {});
  const [type, setType] = useState<keyof typeof TYPES>("pnl");
  return (
    <form action={act} className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="key" value={companyKey} />
        <NativeSelect name="type" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPES)}>
          {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </NativeSelect>
        {type === "pnl" && <Input type="number" name="year" placeholder="Year" title="Year, if not in the file headers" className="w-24" />}
        <input key={type} type="file" name="file" accept={TYPES[type].accept} required className="text-sm" />
        <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
        {s.error && <span className="text-sm text-destructive">{s.error}</span>}
        {s.ok && <span className="text-sm text-success">{s.ok}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{TYPES[type].hint}</p>
    </form>
  );
}
