"use client";
import { useActionState } from "react";
import { renameSector, type SectorState } from "@/app/admin/sectors/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

export function RenameSectorForm({ sectorKey, name }: { sectorKey: string; name: string }) {
  const [state, action, pending] = useActionState(renameSector, {} as SectorState);
  return (
    <form action={action} className="flex max-w-sm items-center gap-2">
      <input type="hidden" name="key" value={sectorKey} />
      <Input name="name" defaultValue={name} required maxLength={60} aria-label={`Name for ${name}`} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Rename</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved</p>}
    </form>
  );
}
