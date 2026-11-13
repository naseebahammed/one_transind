"use client";
import { useActionState } from "react";
import { addUserAction, type UserState } from "@/app/admin/users/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { ACCESS_LEVELS, type Access } from "@/lib/access-levels";

export const ACCESS_LABEL: Record<Access, string> = {
  full: "Full access (all pages)",
  finance: "Finance (dashboard, finance, sales, customers)",
  operations: "Operations (dashboard, sales, properties, restaurants, retail, logistics, trading)",
};

export function AccessSelect({ defaultValue }: { defaultValue: Access }) {
  return (
    <NativeSelect name="access" defaultValue={defaultValue} aria-label="Access level">
      {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{ACCESS_LABEL[level]}</option>)}
    </NativeSelect>
  );
}

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, {} as UserState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="email" type="email" required maxLength={200} placeholder="name@transindgroup.com" aria-label="Microsoft email address" className="max-w-xs" />
      <AccessSelect defaultValue="finance" />
      <Button type="submit" disabled={pending}>Add person</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
