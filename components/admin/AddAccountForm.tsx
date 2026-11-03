"use client";
import { useActionState } from "react";
import { addAccount, type AccountState } from "@/app/admin/accounts/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";

export function AddAccountForm({ mains }: { mains: string[] }) {
  const [state, action, pending] = useActionState(addAccount, {} as AccountState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="main" list="main-accounts" required maxLength={80} placeholder="Main account" aria-label="Main account" className="max-w-xs" />
      <datalist id="main-accounts">{mains.map((m) => <option key={m} value={m} />)}</datalist>
      <Input name="sub" required maxLength={80} placeholder="Sub ledger account" aria-label="Sub ledger account" className="max-w-xs" />
      <Button type="submit" disabled={pending}>Add account</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
