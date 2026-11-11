"use client";
import { useActionState } from "react";
import { uploadEmployees, type EmployeeUploadState } from "@/app/admin/employees/actions";
import { Button } from "@/components/admin/ui/button";

export function UploadEmployees() {
  const [s, act, pending] = useActionState<EmployeeUploadState, FormData>(uploadEmployees, {});
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="file" name="file" accept=".xlsx,.csv" multiple required aria-label="Staff list files" className="text-sm" />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="text-sm text-destructive">{s.error}</span>}
      {s.ok && <span className="text-sm text-success">{s.ok}</span>}
    </form>
  );
}
