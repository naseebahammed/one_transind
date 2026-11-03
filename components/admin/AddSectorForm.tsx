"use client";
import { useActionState } from "react";
import { addSector, type SectorState } from "@/app/admin/sectors/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

export function AddSectorForm() {
  const [state, action, pending] = useActionState(addSector, {} as SectorState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="name" required maxLength={60} placeholder="New sector name" aria-label="New sector name" className="max-w-xs" />
      <Button type="submit" disabled={pending}>Add sector</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
