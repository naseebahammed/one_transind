"use client";
import { useActionState, useState } from "react";
import { uploadReport, type UploadState } from "@/app/admin/al-manzil/actions";
import { Button } from "@/components/admin/ui/button";

const TYPES = {
  pnl: { label: "P&L", accept: ".xlsx", hint: "Excel workbook, first sheet. Replaces the given year's data." },
  daily: { label: "Monthly sales report", accept: ".csv,.xlsx", hint: "CSV or Excel with the daily report columns (date, long/short stay guests and rates, rooms, revenue, occupancy). Days in the file replace the same days." },
} as const;

export function UploadReport({ companyKey }: { companyKey: string }) {
  const [s, act, pending] = useActionState<UploadState, FormData>(uploadReport, {});
  const [type, setType] = useState<keyof typeof TYPES>("pnl");
  return (
    <form action={act} className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="key" value={companyKey} />
        <select name="type" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPES)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        {type === "pnl" && <input type="number" name="year" placeholder="Year" required className="h-9 w-24 rounded-md border bg-background px-2 text-sm" />}
        <input key={type} type="file" name="file" accept={TYPES[type].accept} required className="text-sm" />
        <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
        {s.error && <span className="text-sm text-red-600">{s.error}</span>}
        {s.ok && <span className="text-sm text-emerald-600">{s.ok}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{TYPES[type].hint}</p>
    </form>
  );
}
