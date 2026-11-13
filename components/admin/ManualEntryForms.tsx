"use client";
import { useActionState, useState, type ReactNode } from "react";
import {
  saveManualCogsAction,
  saveManualDailyStayAction,
  saveManualDailyTakingsAction,
  saveManualFinanceCustomerAction,
  saveManualFmcgAction,
  saveManualHrAction,
  saveManualLogisticsAction,
  saveManualMonthlyAction,
  saveManualPnlAction,
  saveManualSalesIndicatorsAction,
  saveManualSalesTargetAction,
  saveManualUnitTypesAction,
  type ManualActionState,
} from "@/app/admin/manual-entry/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { NativeSelect } from "@/components/admin/ui/native-select";
import { LINES, MONTHS, type GridSection } from "@/lib/company-data";
import { fmt } from "@/lib/format";
import {
  COGS_MANUAL_LINES,
  SALES_INDICATORS,
  STANDARD_RECEIPT_CHANNELS,
  UNIT_METRIC_LINES,
} from "@/lib/manual-entry-input";

type CompanyOption = { id: number; name: string };
type BranchOption = { id: number; name: string };
type AccountOption = { main: string; sub: string; normal_sign: 1 | -1 };
type SalesDeptOption = { code: string; label: string };

function StatusBanner({ state }: { state: ManualActionState }) {
  if (state.error) return <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>;
  if (state.ok) return <p className="text-sm font-medium text-success">{state.ok}</p>;
  return null;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function YearMonthFields({ year, month, years }: { year: number; month: number; years: number[] }) {
  return (
    <>
      <Field label="Year">
        <NativeSelect name="year" defaultValue={String(year)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Month">
        <NativeSelect name="month" defaultValue={String(month)}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </NativeSelect>
      </Field>
    </>
  );
}

export function ManualPnlForm({
  companyId,
  branchId,
  year,
  month,
  years,
  accounts,
}: {
  companyId: number;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
  accounts: AccountOption[];
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualPnlAction, {});
  const groups = [...new Set(accounts.map((a) => a.main))];

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <YearMonthFields year={year} month={month} years={years} />
        <Field label="Account (Chart of accounts)">
          <NativeSelect name="account" required defaultValue="">
            <option value="" disabled>Select account…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {accounts.filter((a) => a.main === g).map((a) => (
                  <option key={`${a.main}|${a.sub}`} value={`${a.main}|${a.sub}`}>
                    {a.sub} ({a.normal_sign > 0 ? "Revenue +" : "Cost −"})
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Amount (QAR)">
          <Input name="value" type="number" step="0.01" required placeholder="0.00" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="autoSign" value="1" defaultChecked className="rounded border-input" />
          Apply standard sign automatically (revenue positive, cost negative)
        </label>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save P&L figure"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualMonthlySectionForm({
  section,
  title,
  hint,
  companyId,
  branchId,
  year,
  month,
  years,
  currentValues,
}: {
  section: GridSection;
  title: string;
  hint: string;
  companyId: number;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
  currentValues: Record<string, number>;
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualMonthlyAction, {});
  const lines = LINES[section];
  const isWhole = (line: string) => line === "Headcount" || line === "Joiners" || line === "Leavers";

  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId ?? ""} />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <YearMonthFields year={year} month={month} years={years} />
        {lines.map((line) => (
          <Field key={line} label={isWhole(line) ? line : `${line} (QAR)`}>
            <Input
              key={`${companyId}-${branchId ?? "all"}-${year}-${month}-${line}-${currentValues[line] ?? ""}`}
              name={`line_${line}`}
              type="number"
              step={isWhole(line) ? "1" : "0.01"}
              min="0"
              required
              defaultValue={currentValues[line] ?? ""}
              placeholder="0"
            />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : `Save ${title}`}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualDailyStayForm({
  companyId,
  branchId,
  defaultDate,
  totalRooms,
}: {
  companyId: number;
  branchId: number | null;
  defaultDate: string;
  totalRooms: number;
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualDailyStayAction, {});
  const [occupied, setOccupied] = useState(0);
  const [available, setAvailable] = useState(totalRooms > 0 ? totalRooms : 0);
  const [roomRev, setRoomRev] = useState(0);

  const occPct = available > 0 ? (occupied / available) * 100 : 0;
  const adr = occupied > 0 ? roomRev / occupied : 0;
  const revPar = available > 0 ? roomRev / available : 0;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Stay date">
          <Input name="date" type="date" required defaultValue={defaultDate} />
        </Field>
        <Field label="Rooms occupied">
          <Input name="rooms_occupied" type="number" step="0.01" min="0" placeholder="0" onChange={(e) => setOccupied(Number(e.target.value) || 0)} />
        </Field>
        <Field label={totalRooms > 0 ? `Rooms available (max ${totalRooms})` : "Rooms available"}>
          <Input
            name="rooms_available"
            type="number"
            step="0.01"
            min="0"
            defaultValue={totalRooms > 0 ? String(totalRooms) : ""}
            placeholder="0"
            onChange={(e) => setAvailable(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Room revenue (QAR)">
          <Input name="room_revenue" type="number" step="0.01" placeholder="0.00" onChange={(e) => setRoomRev(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Long-stay guests / rooms">
          <Input name="long_guests" type="number" step="0.01" min="0" placeholder="0" />
        </Field>
        <Field label="Long-stay average rate (QAR)">
          <Input name="long_rate" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
        <Field label="Long-stay total (QAR)">
          <Input name="long_total" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
        <Field label="Other revenue (QAR)">
          <Input name="other_revenue" type="number" step="0.01" placeholder="0.00" />
        </Field>
        <Field label="Short-stay guests / rooms">
          <Input name="short_guests" type="number" step="0.01" min="0" placeholder="0" />
        </Field>
        <Field label="Short-stay average rate (QAR)">
          <Input name="short_rate" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
        <Field label="Short-stay total (QAR)">
          <Input name="short_total" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span>Calculated preview (derived on demand, never stored):</span>
        <span className="font-mono text-foreground">
          Occupancy: {fmt(occPct, 1)}% · ADR: {fmt(adr, 2)} QAR · RevPAR: {fmt(revPar, 2)} QAR
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save daily stay row"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualUnitTypesForm({
  companyId,
  branchId,
  year,
  month,
  years,
  suggestedUnitTypes,
}: {
  companyId: number;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
  suggestedUnitTypes: string[];
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualUnitTypesAction, {});
  const options = [...new Set(["1 BHK", "2 BHK", "3 BHK", "Studio", ...suggestedUnitTypes])];

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <YearMonthFields year={year} month={month} years={years} />
        <Field label="Unit type">
          <Input name="unitType" list="manual-unit-types-list" required placeholder="e.g. 1 BHK" />
          <datalist id="manual-unit-types-list">
            {options.map((u) => <option key={u} value={u} />)}
          </datalist>
        </Field>
        {UNIT_METRIC_LINES.map((line) => (
          <Field key={line} label={line === "Room revenue" ? "Room revenue (QAR)" : `${line} (room-nights / units)`}>
            <Input name={`unit_${line}`} type="number" step="0.01" placeholder="Leave blank to skip" />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save unit-type figures"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualDailyTakingsForm({
  companyId,
  branches,
  defaultBranchId,
  defaultDate,
}: {
  companyId: number;
  branches: BranchOption[];
  defaultBranchId: number | null;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualDailyTakingsAction, {});

  if (!branches.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Daily takings are recorded per branch. Enable branches and add at least one branch on this company&apos;s profile page first.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Branch">
          <NativeSelect name="branchId" required defaultValue={String(defaultBranchId ?? branches[0].id)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Takings date">
          <Input name="date" type="date" required defaultValue={defaultDate} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STANDARD_RECEIPT_CHANNELS.map((channel) => (
          <Field
            key={channel}
            label={`${channel} (QAR)`}
            hint={channel === "Bank deposits" ? "Tracked separately; excluded from Gross Sales" : undefined}
          >
            <Input name={`ch_${channel}`} type="number" step="0.01" placeholder="—" />
          </Field>
        ))}
        <Field label="Custom channel name">
          <Input name="customChannel" placeholder="Optional extra channel" maxLength={60} />
        </Field>
        <Field label="Custom channel amount (QAR)">
          <Input name="customValue" type="number" step="0.01" placeholder="—" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save daily takings"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualCogsForm({
  companyId,
  branchId,
  year,
  month,
  years,
}: {
  companyId: number;
  branchId: number | null;
  year: number;
  month: number;
  years: number[];
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualCogsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="branchId" value={branchId ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <YearMonthFields year={year} month={month} years={years} />
        {COGS_MANUAL_LINES.map(([line, sign]) => (
          <Field
            key={line}
            label={`${line} (QAR)`}
            hint={sign < 0 ? "Stored as negative cost/deduction" : undefined}
          >
            <Input name={`cogs_${line}`} type="number" step="0.01" placeholder="Leave blank to skip" />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save COGS figures"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualSalesTargetForm({
  departments,
  year,
  month,
  years,
}: {
  departments: SalesDeptOption[];
  year: number;
  month: number;
  years: number[];
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualSalesTargetAction, {});

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Sales department">
          {departments.length ? (
            <NativeSelect name="code" required defaultValue={departments[0].code}>
              {departments.map((d) => <option key={d.code} value={d.code}>{d.label} ({d.code})</option>)}
            </NativeSelect>
          ) : (
            <Input name="code" required placeholder="Department code" />
          )}
        </Field>
        <YearMonthFields year={year} month={month} years={years} />
        <Field label="Monthly target (QAR)">
          <Input name="target" type="number" step="0.01" min="0" required placeholder="0.00" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save department target"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualSalesIndicatorsForm({
  departments,
  year,
  month,
  years,
}: {
  departments: SalesDeptOption[];
  year: number;
  month: number;
  years: number[];
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualSalesIndicatorsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Scope / department">
          <NativeSelect name="departmentCode" defaultValue="">
            <option value="">All departments (Group)</option>
            {departments.map((d) => <option key={d.code} value={d.code}>{d.label} ({d.code})</option>)}
          </NativeSelect>
        </Field>
        <YearMonthFields year={year} month={month} years={years} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SALES_INDICATORS.map(([key, label, unit]) => (
          <Field key={key} label={`${label} (${unit})`}>
            <Input name={`ind_${key}`} type="number" step="0.01" placeholder="Leave blank to skip" />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save sector indicators"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

function FmcgSubForm({ kind, title, buttonLabel, children }: { kind: string; title: string; buttonLabel: string; children: ReactNode }) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualFmcgAction, {});
  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4">
      <input type="hidden" name="fmcgKind" value={kind} />
      <div className="text-sm font-semibold">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : buttonLabel}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualFmcgForms({
  year,
  month,
  years,
  defaultDate,
}: {
  year: number;
  month: number;
  years: number[];
  defaultDate: string;
}) {
  return (
    <div className="grid gap-4">
      <FmcgSubForm kind="brand" title="Add / update FMCG brand" buttonLabel="Save brand">
        <Field label="Brand code"><Input name="code" placeholder="Optional (uses name)" /></Field>
        <Field label="Brand name *"><Input name="name" required placeholder="e.g. AL KABEER" /></Field>
        <Field label="Department"><Input name="department" placeholder="e.g. Frozen" /></Field>
        <Field label="Brand manager"><Input name="manager" placeholder="Manager name" /></Field>
        <Field label="Category"><Input name="category" placeholder="Category" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="salesman" title="Add / update FMCG salesman" buttonLabel="Save salesman">
        <Field label="Salesman code *"><Input name="code" required placeholder="e.g. 014" /></Field>
        <Field label="Full name *"><Input name="name" required placeholder="Salesman name" /></Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue="Active">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </NativeSelect>
        </Field>
        <Field label="Route"><Input name="route" placeholder="Route name" /></Field>
        <Field label="Team lead / supervisor"><Input name="teamLead" placeholder="Team lead" /></Field>
        <Field label="Manager"><Input name="manager" placeholder="Manager" /></Field>
        <Field label="Sales category"><Input name="salesCategory" placeholder="e.g. Retail / HORECA" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="customer" title="Add / update FMCG customer master" buttonLabel="Save customer">
        <Field label="Customer code *"><Input name="code" required placeholder="e.g. C1024" /></Field>
        <Field label="Customer name *"><Input name="name" required placeholder="Account name" /></Field>
        <Field label="Group"><Input name="groupName" placeholder="Key account group" /></Field>
        <Field label="Credit days"><Input name="creditDays" type="number" min="0" step="1" placeholder="e.g. 60" /></Field>
        <Field label="Accountant"><Input name="accountant" placeholder="Accountant" /></Field>
        <Field label="Balance (QAR)"><Input name="balance" type="number" step="0.01" placeholder="0.00" /></Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue="Active">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </NativeSelect>
        </Field>
      </FmcgSubForm>

      <FmcgSubForm kind="item" title="Add / update FMCG item / SKU" buttonLabel="Save item">
        <Field label="Item code *"><Input name="code" required placeholder="SKU code" /></Field>
        <Field label="Description *"><Input name="name" required placeholder="Product description" /></Field>
        <Field label="Brand *"><Input name="brand" required placeholder="Brand code" /></Field>
        <Field label="Packing"><Input name="packing" placeholder="e.g. 12x1kg" /></Field>
        <Field label="Size"><Input name="size" placeholder="e.g. 1kg" /></Field>
        <Field label="Item type"><Input name="itemType" placeholder="e.g. Chilled" /></Field>
        <Field label="Department"><Input name="department" placeholder="Department" /></Field>
        <Field label="Manager"><Input name="manager" placeholder="Manager" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="assignment" title="Salesman monthly brand target" buttonLabel="Save salesman target">
        <YearMonthFields year={year} month={month} years={years} />
        <Field label="Salesman code *"><Input name="salesmanCode" required placeholder="e.g. 014" /></Field>
        <Field label="Salesman name"><Input name="salesmanName" placeholder="If new salesman" /></Field>
        <Field label="Brand *"><Input name="brand" required placeholder="Brand code" /></Field>
        <Field label="Supervisor"><Input name="supervisor" placeholder="Supervisor" /></Field>
        <Field label="Channel"><Input name="channel" placeholder="e.g. Van / Key Account" /></Field>
        <Field label="Department"><Input name="department" placeholder="Department" /></Field>
        <Field label="Target (QAR) *"><Input name="target" type="number" step="0.01" min="0" required placeholder="0.00" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="managerTarget" title="Manager monthly target" buttonLabel="Save manager target">
        <YearMonthFields year={year} month={month} years={years} />
        <Field label="Manager name *"><Input name="manager" required placeholder="Manager name" /></Field>
        <Field label="Target (QAR) *"><Input name="target" type="number" step="0.01" min="0" required placeholder="0.00" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="stockSnapshot" title="Daily warehouse stock snapshot" buttonLabel="Save stock row">
        <Field label="Stock date *"><Input name="asOf" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="Item code *"><Input name="itemCode" required placeholder="SKU code" /></Field>
        <Field label="Item description"><Input name="itemName" placeholder="Used if new SKU" /></Field>
        <Field label="Brand"><Input name="brand" placeholder="Brand code" /></Field>
        <Field label="Warehouse location *"><Input name="location" required placeholder="e.g. MAIN-DRY" /></Field>
        <Field label="Current qty"><Input name="qtyCurrent" type="number" step="0.01" placeholder="Defaults to balance" /></Field>
        <Field label="Allocated qty"><Input name="qtyAllocated" type="number" step="0.01" placeholder="0" /></Field>
        <Field label="Balance qty *"><Input name="qtyBalance" type="number" step="0.01" required placeholder="0" /></Field>
        <Field label="Stock value (QAR) *"><Input name="value" type="number" step="0.01" required placeholder="0.00" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="deliveryVariance" title="Delivery variance (RV vs DO)" buttonLabel="Save variance row">
        <Field label="DO date *"><Input name="doDate" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="DO number *"><Input name="doNo" required placeholder="DO-0001" /></Field>
        <Field label="Item code *"><Input name="itemCode" required placeholder="SKU code" /></Field>
        <Field label="Location *"><Input name="location" required placeholder="Location" /></Field>
        <Field label="Item description"><Input name="item" placeholder="Item name" /></Field>
        <Field label="Brand"><Input name="brand" placeholder="Brand" /></Field>
        <Field label="Customer code"><Input name="customerCode" placeholder="Customer code" /></Field>
        <Field label="Customer name"><Input name="customer" placeholder="Customer name" /></Field>
        <Field label="Salesman"><Input name="salesman" placeholder="Salesman" /></Field>
        <Field label="Driver"><Input name="driver" placeholder="Driver" /></Field>
        <Field label="Store in-charge"><Input name="storeInCharge" placeholder="Store in-charge" /></Field>
        <Field label="Manager / Supervisor"><Input name="manager" placeholder="Manager" /></Field>
        <Field label="RV qty *"><Input name="qtyRv" type="number" step="0.01" required placeholder="0" /></Field>
        <Field label="DO qty *"><Input name="qtyDo" type="number" step="0.01" required placeholder="0" /></Field>
        <Field label="RV value (QAR) *"><Input name="valueRv" type="number" step="0.01" required placeholder="0.00" /></Field>
        <Field label="DO value (QAR) *"><Input name="valueDo" type="number" step="0.01" required placeholder="0.00" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="consignment" title="Consignment receipt line" buttonLabel="Save consignment">
        <Field label="Received date *"><Input name="receivedDate" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="Line no. *"><Input name="lineNo" type="number" min="1" step="1" required defaultValue="1" /></Field>
        <Field label="Consignment no. *"><Input name="consignmentNo" required placeholder="CNS-001" /></Field>
        <Field label="Item code *"><Input name="itemCode" required placeholder="SKU code" /></Field>
        <Field label="Item description"><Input name="item" placeholder="Product description" /></Field>
        <Field label="Supplier"><Input name="supplier" placeholder="Supplier name" /></Field>
        <Field label="Order no."><Input name="orderNo" placeholder="PO number" /></Field>
        <Field label="Invoice no."><Input name="invoiceNo" placeholder="Supplier invoice" /></Field>
        <Field label="Invoice date"><Input name="invoiceDate" type="date" /></Field>
        <Field label="Location"><Input name="location" placeholder="Warehouse" /></Field>
        <Field label="Expiry date"><Input name="expiryDate" type="date" /></Field>
        <Field label="Billed qty *"><Input name="billedQty" type="number" step="0.01" min="0" required placeholder="0" /></Field>
        <Field label="Received qty *"><Input name="receivedQty" type="number" step="0.01" min="0" required placeholder="0" /></Field>
      </FmcgSubForm>

      <FmcgSubForm kind="stockExpiry" title="Near-expiry stock line" buttonLabel="Save expiry row">
        <Field label="Report date *"><Input name="asOf" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="Report / dept *"><Input name="report" required placeholder="e.g. Dry Goods" /></Field>
        <Field label="Line no. *"><Input name="lineNo" type="number" min="1" step="1" required defaultValue="1" /></Field>
        <Field label="Item code *"><Input name="itemCode" required placeholder="SKU code" /></Field>
        <Field label="Item description"><Input name="item" placeholder="Product description" /></Field>
        <Field label="Brand"><Input name="brand" placeholder="Brand" /></Field>
        <Field label="Location"><Input name="location" placeholder="Warehouse" /></Field>
        <Field label="Cartons"><Input name="cartons" type="number" step="0.01" min="0" placeholder="0" /></Field>
        <Field label="Pieces"><Input name="pieces" type="number" step="0.01" min="0" placeholder="0" /></Field>
        <Field label="Total cost (QAR) *"><Input name="totalCost" type="number" step="0.01" min="0" required placeholder="0.00" /></Field>
        <Field label="Expiry date *"><Input name="expiryDate" type="date" required /></Field>
        <Field label="Remarks"><Input name="remarks" placeholder="Action / remarks" /></Field>
      </FmcgSubForm>
    </div>
  );
}

export function ManualReceivablesForm({ companies, defaultDate }: { companies: CompanyOption[]; defaultDate: string }) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualFinanceCustomerAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="receivablesSnapshot" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Company / scope" hint="Snapshots sum into Group Receivables on Dashboard & Finance">
          <NativeSelect name="companyId" defaultValue="">
            <option value="">Group / Unassigned</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="As-of date *"><Input name="asOf" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="Days sales outstanding (DSO)"><Input name="dsoDays" type="number" step="0.1" min="0" placeholder="e.g. 48.5" /></Field>
        <Field label="Not due (QAR)"><Input name="notDue" type="number" step="0.01" placeholder="0.00" /></Field>
        <Field label="1–30 days (QAR)"><Input name="days1To30" type="number" step="0.01" placeholder="0.00" /></Field>
        <Field label="31–60 days (QAR)"><Input name="days31To60" type="number" step="0.01" placeholder="0.00" /></Field>
        <Field label="61–90 days (QAR)"><Input name="days61To90" type="number" step="0.01" placeholder="0.00" /></Field>
        <Field label="Over 90 days (QAR)"><Input name="over90" type="number" step="0.01" placeholder="0.00" /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save receivables snapshot"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualOverdueInvoiceForm({ companies, defaultDate }: { companies: CompanyOption[]; defaultDate: string }) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualFinanceCustomerAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="overdueInvoice" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Invoice no. *"><Input name="invoiceNo" required placeholder="INV-2026-001" /></Field>
        <Field label="Customer / account *"><Input name="accountName" required placeholder="Account name" /></Field>
        <Field label="Company (optional)">
          <NativeSelect name="companyId" defaultValue="">
            <option value="">Unassigned</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Due date *"><Input name="dueDate" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="Invoice amount (QAR) *"><Input name="amount" type="number" step="0.01" min="0" required placeholder="0.00" /></Field>
        <Field label="Balance due (QAR) *"><Input name="balance" type="number" step="0.01" min="0" required placeholder="0.00" /></Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue="Overdue">
            <option value="Overdue">Overdue</option>
            <option value="Promised">Promised</option>
            <option value="Partial">Partial</option>
            <option value="Disputed">Disputed</option>
            <option value="Legal">Legal</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save overdue invoice"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualEmployeeForm({ departments, defaultDate }: { departments: string[]; defaultDate: string }) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualHrAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="employee" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Employee ID *"><Input name="id" required placeholder="e.g. EMP-1042" /></Field>
        <Field label="Full name *"><Input name="name" required placeholder="Employee name" /></Field>
        <Field label="Department">
          <Input name="department" list="manual-hr-depts" placeholder="Department name" />
          <datalist id="manual-hr-depts">
            {departments.map((d) => <option key={d} value={d} />)}
          </datalist>
        </Field>
        <Field label="Job title / designation"><Input name="designation" placeholder="Job title" /></Field>
        <Field label="Nationality"><Input name="nationality" placeholder="Nationality" /></Field>
        <Field label="Joined date *"><Input name="joined" type="date" required defaultValue={defaultDate} /></Field>
        <Field label="Left / resigned date" hint="Leave blank for active staff"><Input name="left" type="date" /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save employee"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualLogisticsKpisForm({
  current,
}: {
  current: { fleetCount: number | null; onRouteCount: number | null; outletsReached: number | null } | null;
}) {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualLogisticsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="kpis" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Total fleet count" hint="Leave blank to count Fleet table rows automatically">
          <Input name="fleetCount" type="number" min="0" step="1" defaultValue={current?.fleetCount ?? ""} placeholder="Auto from fleet table" />
        </Field>
        <Field label="Vehicles on route" hint="Leave blank to count 'On route' vehicles">
          <Input name="onRouteCount" type="number" min="0" step="1" defaultValue={current?.onRouteCount ?? ""} placeholder="Auto from fleet table" />
        </Field>
        <Field label="Outlets reached">
          <Input name="outletsReached" type="number" min="0" step="1" defaultValue={current?.outletsReached ?? ""} placeholder="e.g. 420" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save KPI overrides"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualFleetVehicleForm() {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualLogisticsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="fleet" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Vehicle / plate no. *"><Input name="vehicleNo" required placeholder="e.g. QAT-48291" /></Field>
        <Field label="Vehicle type"><Input name="vehicleType" placeholder="e.g. 3.5T Reefer Van" /></Field>
        <Field label="Driver name"><Input name="driverName" placeholder="Driver name" /></Field>
        <Field label="Assigned route"><Input name="route" placeholder="e.g. Doha North" /></Field>
        <Field label="Temperature mode">
          <NativeSelect name="temperatureMode" defaultValue="Dry">
            <option value="Dry">Dry</option>
            <option value="Chilled">Chilled</option>
            <option value="Frozen">Frozen</option>
            <option value="Multi-temp">Multi-temp</option>
          </NativeSelect>
        </Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue="On route">
            <option value="On route">On route</option>
            <option value="Idle">Idle</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Off duty">Off duty</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save vehicle"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualShipmentForm() {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualLogisticsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="shipment" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Shipment ID *"><Input name="shipmentCode" required placeholder="e.g. SHP-1040" /></Field>
        <Field label="Destination *"><Input name="destination" required placeholder="Customer or hub" /></Field>
        <Field label="Temperature"><Input name="temperature" placeholder="e.g. -18°C / Chilled 4°C" /></Field>
        <Field label="Vehicle"><Input name="vehicle" placeholder="Plate or truck ID" /></Field>
        <Field label="ETA"><Input name="eta" placeholder="e.g. 14:30 or 2026-11-15" /></Field>
        <Field label="Status" hint="'Late' counts in Dashboard Needs follow-up">
          <NativeSelect name="status" defaultValue="In transit">
            <option value="In transit">In transit</option>
            <option value="On time">On time</option>
            <option value="Late">Late</option>
            <option value="Loading">Loading</option>
            <option value="Delivered">Delivered</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save shipment"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualWarehouseForm() {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualLogisticsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="warehouse" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Warehouse name *"><Input name="name" required placeholder="e.g. Birkat Al Awamer Cold Store" /></Field>
        <Field label="Location"><Input name="location" placeholder="Industrial Area / Wukair" /></Field>
        <Field label="Temperature zone">
          <NativeSelect name="temperatureZone" defaultValue="Dry">
            <option value="Dry">Dry</option>
            <option value="Chilled">Chilled</option>
            <option value="Frozen">Frozen</option>
            <option value="Ambient">Ambient</option>
            <option value="Mixed">Mixed</option>
          </NativeSelect>
        </Field>
        <Field label="Capacity (pallets)"><Input name="capacityPallets" type="number" min="0" step="1" placeholder="0" /></Field>
        <Field label="Occupied (pallets)"><Input name="occupiedPallets" type="number" min="0" step="1" placeholder="0" /></Field>
        <Field label="Status">
          <NativeSelect name="status" defaultValue="Operational">
            <option value="Operational">Operational</option>
            <option value="Near capacity">Near capacity</option>
            <option value="Maintenance">Maintenance</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save warehouse"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

export function ManualCustomsForm() {
  const [state, action, pending] = useActionState<ManualActionState, FormData>(saveManualLogisticsAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="recordKind" value="customs" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Bill of lading no. *"><Input name="bolNo" required placeholder="e.g. MEDU-884120" /></Field>
        <Field label="Customer / consignee *"><Input name="customer" required placeholder="Consignee or division" /></Field>
        <Field label="Port / border"><Input name="port" placeholder="e.g. Hamad Port / Abu Samra" /></Field>
        <Field label="ETA date"><Input name="eta" type="date" /></Field>
        <Field label="Clearance status">
          <NativeSelect name="status" defaultValue="Pending">
            <option value="Pending">Pending</option>
            <option value="Inspection">Inspection</option>
            <option value="Duty paid">Duty paid</option>
            <option value="Cleared">Cleared</option>
            <option value="Held">Held</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save customs entry"}</Button>
        <StatusBanner state={state} />
      </div>
    </form>
  );
}

