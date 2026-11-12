"use client";
import { useActionState } from "react";
import { uploadSettlements, type EmployeeUploadState } from "@/app/admin/employees/actions";
import { Button } from "@/components/admin/ui/button";

export function UploadSettlements() {
  const [s, act, pending] = useActionState<EmployeeUploadState, FormData>(uploadSettlements, {});
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="file" name="file" accept=".xlsx" required aria-label="Settlements file" className="text-sm" />
      <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
      {s.error && <span role="alert" className="text-sm text-destructive">{s.error}</span>}
      {s.ok && <span className="text-sm text-success">{s.ok}</span>}
    </form>
  );
}
