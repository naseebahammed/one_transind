"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";

type Account = { main: string; sub: string; m: (number | undefined)[] };

/** Step-wise editor for one figure (P&L or sales): pick year (fixed to the page), month, account, then edit and confirm. */
export function EditPnlFigure({ year, months, accounts, onSave }: { year: number; months: string[]; accounts: Account[]; onSave: (main: string, sub: string, month: number, value: number) => Promise<void> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [account, setAccount] = useState("");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  const row = accounts.find((a) => `${a.main}|${a.sub}` === account);
  const current = row && month !== "" ? row.m[+month] : undefined;

  const reset = () => { setOpen(false); setMonth(""); setAccount(""); setValue(""); };

  if (!open) return <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Edit data</Button>;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
      <NativeSelect aria-label="Year" value={year} disabled><option value={year}>{year}</option></NativeSelect>
      <NativeSelect aria-label="Month" value={month} onChange={(e) => { setMonth(e.target.value); setValue(""); }}>
        <option value="" disabled>Month…</option>
        {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Account" value={account} onChange={(e) => { setAccount(e.target.value); setValue(""); }}>
        <option value="" disabled>Account…</option>
        {accounts.map((a) => <option key={`${a.main}|${a.sub}`} value={`${a.main}|${a.sub}`}>{a.main} · {a.sub}</option>)}
      </NativeSelect>
      {row && month !== "" && (
        <>
          <span className="text-sm text-muted-foreground">Current: {current ?? "—"}</span>
          <Input
            type="number" step="0.01" placeholder="New value" value={value}
            onChange={(e) => setValue(e.target.value)} className="w-28" aria-label="New value"
          />
          <Button
            type="button" size="sm" disabled={pending || value.trim() === "" || !Number.isFinite(Number(value))}
            onClick={async () => {
              if (!confirm(`Save ${row.main} · ${row.sub} for ${months[+month]} ${year}: ${current ?? "—"} → ${value}?`)) return;
              setPending(true);
              await onSave(row.main, row.sub, +month, Number(value));
              router.refresh();
              setPending(false);
              reset();
            }}
          >{pending ? "Saving…" : "Save"}</Button>
        </>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={reset}>Cancel</Button>
    </div>
  );
}
