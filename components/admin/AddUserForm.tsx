"use client";
import { useActionState } from "react";
import { addUserAction, type UserState } from "@/app/admin/users/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, {} as UserState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="email" type="email" required maxLength={200} placeholder="name@transindgroup.com" aria-label="Microsoft email address" className="max-w-xs" />
      <Button type="submit" disabled={pending}>Add person</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
