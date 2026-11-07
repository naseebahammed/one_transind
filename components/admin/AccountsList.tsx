"use client";
import { useState } from "react";
import { Check, ChevronRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { deleteAccount, updateAccount } from "@/app/admin/accounts/actions";
import { AddAccountForm } from "@/components/admin/AddAccountForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import type { Account } from "@/lib/accounts";

export function AccountsList({ rows }: { rows: Account[] }) {
  const [q, setQ] = useState("");
  const [main, setMain] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const mains = [...new Set(rows.map((a) => a.main))]; // rows arrive in sheet order
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((a) => (!main || a.main === main) && (!needle || (a.main + " " + a.sub).toLowerCase().includes(needle)));
  const counts = Map.groupBy(rows, (a) => a.main);
  const groups = [...Map.groupBy(shown, (a) => a.main)];
  const searching = !!(needle || main); // a filter expands the groups so matches are visible
  const toggle = (m: string) => setOpen((o) => { const n = new Set(o); if (!n.delete(m)) n.add(m); return n; });
  const largest = [...counts].sort((a, b) => b[1].length - a[1].length)[0];
  const stats: [string, string | number, string][] = [
    ["Sub ledger accounts", rows.length, `Across ${mains.length} main accounts`],
    ["Main accounts", mains.length, "Groups on the chart"],
    ["Largest group", largest?.[1].length ?? 0, largest?.[0] ?? "-"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value, hint]) => (
          <Card key={label} className="gap-1 py-4">
            <CardContent>
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="text-3xl font-semibold tabular-nums">{value}</div>
              <div className="truncate text-xs text-muted-foreground">{hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts" aria-label="Search accounts" className="pl-9" />
          </div>
          <NativeSelect value={main} onChange={(e) => setMain(e.target.value)} aria-label="Filter by main account" className="max-w-56">
            <option value="">All main accounts</option>
            {mains.map((m) => <option key={m} value={m}>{m}</option>)}
          </NativeSelect>
          <Button className="ml-auto" variant={adding ? "outline" : "default"} onClick={() => setAdding(!adding)}>
            {adding ? <><X />Close</> : <><Plus />Add account</>}
          </Button>
        </div>
        {adding && <div className="border-b bg-muted/40 p-3"><AddAccountForm mains={mains} /></div>}

        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Main account / Sub ledger account</TableHead>
              <TableHead className="w-24 text-right">
                {!searching && <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(open.size ? new Set() : new Set(mains))}>{open.size ? "Collapse all" : "Expand all"}</Button>}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([m, items]) => {
              const expanded = searching || open.has(m);
              return [
                <TableRow key={m} onClick={() => !searching && toggle(m)} className={`bg-muted/30 ${searching ? "" : "cursor-pointer"}`}>
                  <TableCell colSpan={2}>
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                      <span className="font-semibold tracking-wide">{m}</span>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                  </TableCell>
                </TableRow>,
                ...(expanded ? items.map((a) =>
                  editing === a.id ? (
                    <TableRow key={a.id}>
                      <TableCell colSpan={2} className="pl-11">
                        <form action={async (f) => { const r = await updateAccount(f); setEditError(r.error ?? ""); if (!r.error) setEditing(null); }} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          <Input name="main" defaultValue={a.main} required maxLength={80} aria-label="Main account" className="h-8 max-w-56" />
                          <Input name="sub" defaultValue={a.sub} required maxLength={80} autoFocus aria-label="Sub ledger account" className="h-8 max-w-sm flex-1" />
                          <Button type="submit" size="icon-sm" aria-label="Save"><Check /></Button>
                          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}><X /></Button>
                          {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
                        </form>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={a.id}>
                      <TableCell className="pl-11">{a.sub}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${a.sub}`} onClick={() => { setEditing(a.id); setEditError(""); }}><Pencil /></Button>
                          {!a.used && <form action={deleteAccount}>
                            <input type="hidden" name="id" value={a.id} />
                            <ConfirmButton size="icon-sm" variant="ghost" aria-label={`Delete ${a.sub}`} className="text-destructive hover:text-destructive" message={`Delete ${a.sub}?`}><Trash2 /></ConfirmButton>
                          </form>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                ) : []),
              ];
            })}
            {!groups.length && <TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">{rows.length ? "No accounts match your filters." : "No accounts yet."}</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">Showing {shown.length} of {rows.length}</div>
      </Card>
    </div>
  );
}
