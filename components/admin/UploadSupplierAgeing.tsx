"use client";
import { useActionState } from "react";
import { uploadSupplierAgeing, type SupplierAgeingUploadState } from "@/app/admin/finance/actions";
import { FileDropzone } from "@/components/admin/FileDropzone";
import { Button } from "@/components/admin/ui/button";

export function UploadSupplierAgeing() {
  const [s, act, pending] = useActionState<SupplierAgeingUploadState, FormData>(uploadSupplierAgeing, {});
  return (
    <form action={act} className="flex flex-wrap items-start gap-2">
      <label className="flex items-center gap-2 text-sm">Report date <input type="date" name="asOf" required className="rounded border px-2 py-1" /></label>
      <FileDropzone name="file" accept=".xlsx" ariaLabel="Supplier ageing file" disabled={pending} resetToken={s.ok ? s : undefined} />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="self-center text-sm text-destructive">{s.error}</span>}
      {s.ok && <span role="status" className="self-center text-sm text-success">{s.ok}</span>}
    </form>
  );
}
