"use client";
import { useActionState } from "react";
import { uploadProfitability, type ProfitabilityUploadState } from "@/app/admin/logistics/actions";
import { FileDropzone } from "@/components/admin/FileDropzone";
import { Button } from "@/components/admin/ui/button";
import { PROFITABILITY_LINES } from "@/lib/profitability";

export function UploadProfitability() {
  const [s, act, pending] = useActionState<ProfitabilityUploadState, FormData>(uploadProfitability, {});
  return (
    <form action={act} className="flex flex-wrap items-start gap-2">
      <label className="flex items-center gap-2 text-sm">Line <select name="line" required className="rounded border px-2 py-1">{PROFITABILITY_LINES.map((l) => <option key={l}>{l}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm">Year <input type="number" name="year" required min={2000} defaultValue={new Date().getFullYear()} className="w-24 rounded border px-2 py-1" /></label>
      <FileDropzone name="file" accept=".xlsx" ariaLabel="Profitability file" disabled={pending} resetToken={s.ok ? s : undefined} />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="self-center text-sm text-destructive">{s.error}</span>}
      {s.ok && <span role="status" className="self-center text-sm text-success">{s.ok}</span>}
    </form>
  );
}
