"use client";
import { useActionState } from "react";
import { addPropertyType, type PropertyTypeState } from "@/app/admin/company-types/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

export function AddCompanyTypeForm() {
  const [state, action, pending] = useActionState(addPropertyType, {} as PropertyTypeState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="name" required maxLength={60} placeholder="New company type name" aria-label="New company type name" className="max-w-xs" />
      <Button type="submit" disabled={pending}>Add company type</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
