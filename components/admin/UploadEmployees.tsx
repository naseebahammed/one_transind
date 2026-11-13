"use client";
import { useActionState } from "react";
import { uploadEmployees, type EmployeeUploadState } from "@/app/admin/employees/actions";
import { FileDropzone } from "@/components/admin/FileDropzone";
import { Button } from "@/components/admin/ui/button";

export function UploadEmployees() {
  const [s, act, pending] = useActionState<EmployeeUploadState, FormData>(uploadEmployees, {});
  return (
    <form action={act} className="flex flex-wrap items-start gap-2">
      <FileDropzone name="file" accept=".xlsx,.csv" multiple ariaLabel="Staff list files" disabled={pending} resetToken={s.ok ? s : undefined} />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="self-center text-sm text-destructive">{s.error}</span>}
      {s.ok && <span role="status" className="self-center text-sm text-success">{s.ok}</span>}
    </form>
  );
}
