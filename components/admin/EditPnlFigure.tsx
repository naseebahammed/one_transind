"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { fmt } from "@/lib/format";

type Account = { main: string; sub: string; m: (number | undefined)[] };

/** Step-wise or click-any-cell editor for one figure (P&L, monthly sales, or company figures), with a themed confirmation modal. */
export function EditPnlFigure({
  year,
  months,
  accounts,
  onSave,
  gridId,
}: {
  year: number;
  months: string[];
  accounts: Account[];
  onSave: (main: string, sub: string, month: number, value: number) => Promise<string | null | void>;
  gridId?: string;
}) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [account, setAccount] = useState("");
  const [value, setValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [refused, setRefused] = useState("");

  const row = accounts.find((a) => `${a.main}|${a.sub}` === account);
  const current = row && month !== "" ? row.m[+month] : undefined;
  const parsedValue = Number(value);
  const canSave = !pending && Boolean(row) && month !== "" && value.trim() !== "" && Number.isFinite(parsedValue);

  const reset = () => {
    setOpen(false);
    setConfirmOpen(false);
    setMonth("");
    setAccount("");
    setValue("");
    setRefused("");
  };

  useEffect(() => {
    if (!gridId) return;
    const handleClick = (e: MouseEvent) => {
      const trigger = (e.target as Element | null)?.closest<HTMLElement>("[data-edit-grid]");
      if (!trigger || trigger.dataset.editGrid !== gridId) return;
      const main = trigger.dataset.main ?? "";
      const sub = trigger.dataset.sub ?? "";
      const monthIdx = trigger.dataset.month ?? "";
      const matched = accounts.find((a) => a.main === main && a.sub === sub);
      if (!matched || monthIdx === "") return;

      const existing = matched.m[+monthIdx];
      setOpen(true);
      setAccount(`${main}|${sub}`);
      setMonth(monthIdx);
      setValue(existing !== undefined ? String(existing) : "");
      setRefused("");

      window.requestAnimationFrame(() => {
        barRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [accounts, gridId]);

  const commitSave = async () => {
    if (!row || month === "" || !Number.isFinite(parsedValue)) return;
    setConfirmOpen(false);
    setPending(true);
    setRefused("");
    try {
      const reason = await onSave(row.main, row.sub, +month, parsedValue);
      if (reason) {
        setRefused(reason);
        return;
      }
      router.refresh();
      reset();
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title={gridId ? "Click here or click any figure cell in the table below to edit" : undefined}
      >
        <Pencil className="size-3.5" />
        Edit data
      </Button>
    );
  }

  const accountLabel = row ? (row.main ? `${row.main} · ${row.sub}` : row.sub) : "";

  return (
    <div ref={barRef} className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3 shadow-xs">
      <NativeSelect aria-label="Year" value={year} disabled className="h-8 w-20">
        <option value={year}>{year}</option>
      </NativeSelect>
      <NativeSelect
        aria-label="Month"
        value={month}
        className="h-8"
        onChange={(e) => {
          const nextMonth = e.target.value;
          setMonth(nextMonth);
          const existing = row && nextMonth !== "" ? row.m[+nextMonth] : undefined;
          setValue(existing !== undefined ? String(existing) : "");
          setRefused("");
        }}
      >
        <option value="" disabled>
          Month…
        </option>
        {months.map((m, i) => (
          <option key={m} value={i}>
            {m}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Account"
        value={account}
        className="h-8 max-w-xs"
        onChange={(e) => {
          const nextAcc = e.target.value;
          setAccount(nextAcc);
          const matched = accounts.find((a) => `${a.main}|${a.sub}` === nextAcc);
          const existing = matched && month !== "" ? matched.m[+month] : undefined;
          setValue(existing !== undefined ? String(existing) : "");
          setRefused("");
        }}
      >
        <option value="" disabled>
          Account…
        </option>
        {accounts.map((a) => (
          <option key={`${a.main}|${a.sub}`} value={`${a.main}|${a.sub}`}>
            {a.main ? `${a.main} · ${a.sub}` : a.sub}
          </option>
        ))}
      </NativeSelect>
      {row && month !== "" && (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            Current: <strong className="font-medium text-foreground">{current !== undefined ? fmt(current, 2, 0) : "—"}</strong>
          </span>
          <Input
            ref={inputRef}
            type="number"
            step="0.01"
            placeholder="New value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) {
                e.preventDefault();
                setConfirmOpen(true);
              } else if (e.key === "Escape") {
                reset();
              }
            }}
            className="h-8 w-32 tabular-nums"
            aria-label="New value"
          />
          <Button type="button" size="sm" disabled={!canSave} onClick={() => setConfirmOpen(true)}>
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </>
      )}
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={reset}>
        Cancel
      </Button>
      {refused && (
        <p role="alert" className="w-full text-xs text-destructive">
          {refused}
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm figure update</AlertDialogTitle>
            <AlertDialogDescription>
              Save <strong>{accountLabel}</strong> for <strong>{month !== "" ? `${months[+month]} ${year}` : year}</strong>:{" "}
              <span className="tabular-nums">{current !== undefined ? fmt(current, 2, 0) : "—"}</span>{" "}
              →{" "}
              <strong className="text-foreground tabular-nums">{Number.isFinite(parsedValue) ? fmt(parsedValue, 2, 0) : value}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={buttonVariants({ variant: "default" })}
              onClick={() => {
                void commitSave();
              }}
            >
              Save figure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
