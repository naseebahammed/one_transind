"use client";
import { useActionState } from "react";
import { uploadSettlements, type EmployeeUploadState } from "@/app/admin/employees/actions";
import { FileDropzone } from "@/components/admin/FileDropzone";
import { Button } from "@/components/admin/ui/button";

export function UploadSettlements() {
  const [s, act, pending] = useActionState<EmployeeUploadState, FormData>(uploadSettlements, {});
  return (
    <form action={act} className="flex flex-wrap items-start gap-2">
      <FileDropzone name="file" accept=".xlsx" ariaLabel="Settlements file" disabled={pending} resetToken={s.ok ? s : undefined} />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="self-center text-sm text-destructive">{s.error}</span>}
      {s.ok && <span role="status" className="self-center text-sm text-success">{s.ok}</span>}
    </form>
  );
}
