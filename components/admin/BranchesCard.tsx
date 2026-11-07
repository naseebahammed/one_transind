"use client";
import { useActionState } from "react";
import { addBranch, setHasBranches, toggleBranch, type BranchState } from "@/app/admin/companies/branch-actions";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import type { Branch } from "@/lib/branches";

export function BranchesCard({ companyId, enabled, branches }: { companyId: number; enabled: boolean; branches: Branch[] }) {
  const [state, action, pending] = useActionState(addBranch.bind(null, companyId), {} as BranchState);
  return (
    <Card>
      <CardContent className="space-y-3">
        <form action={setHasBranches}>
          <input type="hidden" name="id" value={companyId} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={enabled} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
            This company has branches
          </label>
        </form>
        {enabled && <>
        {branches.length === 0 && <p className="text-sm text-muted-foreground">No branches. Figures are kept for the whole company.</p>}
        <ul className="divide-y">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="font-medium">{b.name}</span>
              <Badge variant={b.active ? "success" : "neutral"}>{b.active ? "Active" : "Inactive"}</Badge>
              <form action={toggleBranch} className="ml-auto">
                <input type="hidden" name="id" value={b.id} />
                <Button type="submit" variant="outline" size="sm">{b.active ? "Deactivate" : "Activate"}</Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <Input name="name" required maxLength={60} placeholder="New branch name" aria-label="New branch name" className="max-w-xs" />
          <Button type="submit" disabled={pending}>Add branch</Button>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        </form>
        </>}
      </CardContent>
    </Card>
  );
}
