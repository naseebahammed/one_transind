"use client";
import { useActionState } from "react";
import { uploadBrandBudget, type BrandBudgetUploadState } from "@/app/admin/finance/budget-actions";
import { FileDropzone } from "@/components/admin/FileDropzone";
import { Button } from "@/components/admin/ui/button";

export function UploadBrandBudget() {
  const [s, act, pending] = useActionState<BrandBudgetUploadState, FormData>(uploadBrandBudget, {});
  return (
    <form action={act} className="flex flex-wrap items-start gap-2">
      <label className="flex items-center gap-2 text-sm">Plan <select name="kind" required className="rounded border px-2 py-1"><option value="year">Yearly brand plan</option><option value="month">Monthly plan</option></select></label>
      <label className="flex items-center gap-2 text-sm">Year <input type="number" name="year" required min={2000} defaultValue={new Date().getFullYear() + 1} className="w-24 rounded border px-2 py-1" /></label>
      <FileDropzone name="file" accept=".xlsx" ariaLabel="Budget file" disabled={pending} resetToken={s.ok ? s : undefined} />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="self-center text-sm text-destructive">{s.error}</span>}
      {s.ok && <span role="status" className="self-center text-sm text-success">{s.ok}</span>}
    </form>
  );
}
