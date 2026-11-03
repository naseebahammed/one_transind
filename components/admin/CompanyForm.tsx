"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, Hash, Layers, type LucideIcon } from "lucide-react";
import { saveCompany, type FormState } from "@/app/admin/companies/actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import type { Company } from "@/lib/companies";
import type { RoomType } from "@/lib/companies.shared";

const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>
);

/** Input with a leading icon, for fields worth visually anchoring at a glance. */
const IconInput = ({ icon: Icon, className, ...props }: { icon: LucideIcon } & React.ComponentProps<typeof Input>) => (
  <div className="relative min-w-0 flex-1">
    <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input className={cn("h-10 pl-9", className)} {...props} />
  </div>
);

/** Input with a leading $ sign, for the currency fields. */
const CurrencyInput = ({ className, ...props }: React.ComponentProps<typeof Input>) => (
  <div className="relative min-w-0 flex-1">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
    <Input className={cn("h-10 pl-6", className)} {...props} />
  </div>
);

const ROOM_TYPES = ["1BHK", "2BHK", "Other"] as const;

/** Repeatable rows of unit types (1BHK, 2BHK, Other) with room count, size and the two price options; serialized into one hidden field. */
function RoomTypesField({ initial }: { initial: RoomType[] }) {
  const [rows, setRows] = useState<RoomType[]>(initial);
  const set = (i: number, patch: Partial<RoomType>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const num = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label>Room types</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, { type: ROOM_TYPES[0], rooms: 0, standardPrice: 0 }])}>Add room type</Button>
      </div>
      {!rows.length && <p className="text-xs text-muted-foreground">No room types added yet.</p>}
      {!!rows.length && (
        <div className="hidden gap-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-3">
          <span>Type</span><span>Total rooms</span><span>Standard price</span>
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 border-t pt-3 sm:grid-cols-3">
          <NativeSelect aria-label="Type" value={row.type} onChange={(e) => set(i, { type: e.target.value })}>
            {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
          <Input aria-label="Total rooms" type="number" min={0} placeholder="Total rooms" value={row.rooms} onChange={(e) => set(i, { rooms: num(e.target.value) })} />
          <div className="flex gap-2">
            <CurrencyInput aria-label="Standard price" type="number" min={0} placeholder="Standard price" value={row.standardPrice} onChange={(e) => set(i, { standardPrice: num(e.target.value) })} />
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        </div>
      ))}
      <input type="hidden" name="roomTypes" value={JSON.stringify(rows)} />
    </div>
  );
}

export function CompanyForm({ company, sectors }: { company?: Company; sectors: [string, string][] }) {
  const [state, action, pending] = useActionState(saveCompany, {} as FormState);
  const [sector, setSector] = useState(company?.sector ?? "");
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{company ? "Company details" : "New company"}</CardTitle>
        <CardDescription>{company ? "Update this company's information." : "Fill in the details to add a company to the list."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          {state.error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          {company && <input type="hidden" name="id" value={company.id} />}
          <Field id="name" label="Name"><IconInput id="name" name="name" icon={Building2} required maxLength={120} defaultValue={company?.name} autoFocus /></Field>
          <Field id="sector" label="Sector">
            <div className="relative">
              <Layers className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Select name="sector" required value={sector} onValueChange={setSector}>
                <SelectTrigger id="sector" className="h-10 w-full pl-9"><SelectValue placeholder="Select a sector" /></SelectTrigger>
                <SelectContent>{sectors.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </Field>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id="active" name="active" defaultChecked={company ? !!company.active : true} className="mt-0.5" />
            <div className="space-y-0.5">
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive companies stay on record but are marked as inactive in the list.</p>
            </div>
          </div>
          {sector === "re" /* Real Estate, per lib/org.ts SECTORS */ && (
            <div className="space-y-4 border-t pt-4">
              {/* mb-4!: globals.css forces margin:0 on bare h1-h3 and (being unlayered) beats Tailwind's space-y-4 here. */}
              <h3 className="text-sm font-medium mb-4!">Real estate details</h3>
              <Field id="totalRooms" label="Total number of rooms">
                <div className="flex gap-2">
                  <IconInput id="totalRooms" name="totalRooms" icon={Hash} type="number" min={0} defaultValue={company?.total_rooms ?? 0} />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>Save</Button>
                </div>
              </Field>
              <RoomTypesField initial={company?.room_types ?? []} />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button asChild variant="outline"><Link href="/admin/companies">Cancel</Link></Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : company ? "Save changes" : "Add company"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
