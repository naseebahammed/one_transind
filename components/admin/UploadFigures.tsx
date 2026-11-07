"use client";
import { useActionState } from "react";
import { uploadFigures, type FigureUploadState } from "@/app/admin/companies/figure-actions";
import { Button } from "@/components/admin/ui/button";

export function UploadFigures({ companyId, section, year, branchId }: { companyId: number; section: string; year: number; branchId: number | null }) {
  const [s, act, pending] = useActionState<FigureUploadState, FormData>(uploadFigures, {});
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId ?? ""} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="year" value={year} />
      <input type="file" name="file" accept=".xlsx,.csv" required aria-label="Filled template" className="text-sm" />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="text-sm text-destructive">{s.error}</span>}
      {s.ok && <span className="text-sm text-success">{s.ok}</span>}
    </form>
  );
}
