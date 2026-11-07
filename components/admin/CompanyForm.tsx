"use client";
import { SECTOR } from "@/lib/org";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, Hash, Home, Layers, type LucideIcon } from "lucide-react";
import { saveCompany, type FormState } from "@/app/admin/companies/actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { Switch } from "@/components/admin/ui/switch";
import { Select,SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import type { Company } from "@/lib/companies";
import type { RoomType } from "@/lib/companies.shared";

const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label>{children}</div>
);

/** Input with a leading icon, for fields worth visually anchoring at a glance. */
const IconInput = ({ icon: Icon, className, ...props }: { icon: LucideIcon } & React.ComponentProps<typeof Input>) => (
  <div className="relative min-w-0 flex-1">
    <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input className={cn("pl-9", className)} {...props} />
  </div>
);

/** Input with a leading QAR label, for the currency fields. */
const CurrencyInput = ({ className, ...props }: React.ComponentProps<typeof Input>) => (
  <div className="relative min-w-0 flex-1">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">QAR</span>
    <Input className={cn("pl-11", className)} {...props} />
  </div>
);

const ROOM_TYPES = ["1BHK", "2BHK", "Other"] as const;

/** Repeatable rows of unit types (1BHK, 2BHK, Other) with room count, size and the two price options; serialized into one hidden field. */
function RoomTypesField({ initial }: { initial: RoomType[] }) {
  const [rows, setRows] = useState<RoomType[]>(initial);
  const set = (i: number, patch: Partial<RoomType>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const cols = "sm:grid-cols-[10rem_10rem_10rem_auto]"; // fixed-width fields, left-aligned, so a wide card doesn't stretch them
  return (
    <div className="space-y-1.5 rounded-lg border p-2">
      <div className="flex items-center justify-between">
        <Label>Room types</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, { type: ROOM_TYPES[0], rooms: 0, standardPrice: 0 }])}>Add</Button>
        </div>
      </div>
      {!rows.length && <p className="text-xs text-muted-foreground">No room types added yet.</p>}
      {!!rows.length && (
        <div className={`hidden gap-2 text-xs font-medium text-muted-foreground sm:grid ${cols}`}>
          <span>Type</span><span>Total rooms</span><span>Standard price</span><span />
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className={`grid gap-2 border-t pt-1.5 sm:items-center ${cols}`}>
          <NativeSelect aria-label="Type" value={row.type} onChange={(e) => set(i, { type: e.target.value })}>
            {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
          <Input aria-label="Total rooms" type="number" min={0} placeholder="Total rooms" value={row.rooms} onChange={(e) => set(i, { rooms: num(e.target.value) })} />
          <CurrencyInput aria-label="Standard price" type="number" min={0} placeholder="Standard price" value={row.standardPrice} onChange={(e) => set(i, { standardPrice: num(e.target.value) })} />
          <Button type="button" variant="outline" size="sm" className="h-7 justify-self-start px-2 text-xs" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <input type="hidden" name="roomTypes" value={JSON.stringify(rows)} />
    </div>
  );
}

export function CompanyForm({ company, sectors, propertyTypes }: { company?: Company; sectors: [string, string][]; propertyTypes: [string, string][] }) {
  const [state, action, pending] = useActionState(saveCompany, {} as FormState);
  const [sector, setSector] = useState(company?.sector ?? "");
  const [propertyType, setPropertyType] = useState(company?.property_type || "");
  const [active, setActive] = useState(company ? !!company.active : true);
  return (
    <Card className="w-full gap-2 py-3">
      <form action={action} className="contents">
      <CardHeader className="gap-0">
        {!company && <CardTitle className="text-base">New company</CardTitle>}
        {!company && <CardDescription>Fill in the details to add a company to the list.</CardDescription>}
        <div className="col-start-2 row-span-2 row-start-1 flex items-center gap-2 justify-self-end">
          <Label htmlFor="active">{active ? "Active" : "Inactive"}</Label>
          <Switch id="active" name="active" checked={active} onCheckedChange={setActive} title="Inactive companies stay on record but are marked inactive in the list." />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {state.error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          {company && <input type="hidden" name="id" value={company.id} />}
          <div className="grid gap-3 md:grid-cols-2">
            <Field id="name" label="Name"><IconInput id="name" name="name" icon={Building2} required maxLength={120} defaultValue={company?.name} autoFocus /></Field>
            <Field id="logo" label="Logo">
              <div className="flex items-center gap-2">
                {company?.has_logo && <img src={`/api/companies/${company.id}/logo`} alt="" className="size-9 rounded-md border object-contain" />}
                <Input id="logo" name="logo" type="file" accept="image/*" className="text-sm" />
              </div>
            </Field>
            <Field id="sector" label="Sector">
              <div className="relative">
                <Layers className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <Select name="sector" required value={sector} onValueChange={setSector}>
                  <SelectTrigger id="sector" className="w-full pl-9"><SelectValue placeholder="Select a sector" /></SelectTrigger>
                  <SelectContent>{sectors.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Field>
            <Field id="erpCode" label="ERP code"><Input id="erpCode" name="erpCode" maxLength={20} defaultValue={company?.erp_code} /></Field>          </div>
          {sector === SECTOR.realEstate && (
            <div className="space-y-2 border-t pt-2">
              <h3 className="pb-2 text-sm font-medium mb-0!">Real estate details</h3>
              <div className="flex flex-wrap items-end gap-3">
                <Field id="propertyType" label="Property type">
                  <div className="relative">
                    <Home className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Select name="propertyType" value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger id="propertyType" className="w-40 pl-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{propertyTypes.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </Field>
                <Field id="totalRooms" label={propertyType === "villa" ? "Number of villas" : "Total number of rooms"}>
                  <div className="flex gap-2">
                    <IconInput id="totalRooms" name="totalRooms" icon={Hash} type="number" min={0} defaultValue={company?.total_rooms ?? 0} className="w-40" />
                    <Button type="submit" variant="outline" size="sm" disabled={pending}>Save</Button>
                  </div>
                </Field>
              </div>
              <RoomTypesField initial={company?.room_types ?? []} />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button asChild variant="outline"><Link href="/admin/companies">Cancel</Link></Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : company ? "Save changes" : "Add company"}</Button>
          </div>
        </div>
      </CardContent>
      </form>
    </Card>
  );
}
