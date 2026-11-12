"use client";
import { useActionState } from "react";
import {
  clearCompanyReceivablesAction,
  saveCompanyReceivablesAction,
  type CompanyReceivablesState,
} from "@/app/admin/companies/[id]/receivables-actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { cn } from "@/lib/cn";
import { fmt } from "@/lib/format";
import type { SnapshotReceivablesInput } from "@/lib/receivables-rollup";

const CurrencyInput = ({ className, ...props }: React.ComponentProps<typeof Input>) => (
  <div className="relative min-w-0 flex-1">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">QAR</span>
    <Input className={cn("pl-11", className)} {...props} />
  </div>
);

export function CompanyReceivablesCard({
  companyId,
  companyName,
  snapshot,
}: {
  companyId: number;
  companyName: string;
  snapshot: SnapshotReceivablesInput | null;
}) {
  const [state, formAction, pending] = useActionState<CompanyReceivablesState, FormData>(
    saveCompanyReceivablesAction,
    {},
  );
  const defaultDate = snapshot?.asOf ?? new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Receivables aging (QAR)</CardTitle>
        <CardDescription>
          Monthly open receivables aging for {companyName}. Combined with ERP Trading receivables on the Group Dashboard and Finance pages.
          {snapshot ? ` Current total: ${fmt(snapshot.total)} QAR (as of ${snapshot.asOf}).` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="companyId" value={companyId} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor={`ar-asof-${companyId}`}>As of date</Label>
              <Input id={`ar-asof-${companyId}`} name="asOf" type="date" required defaultValue={defaultDate} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ar-dso-${companyId}`}>DSO (days, optional)</Label>
              <Input
                id={`ar-dso-${companyId}`}
                name="dsoDays"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 28"
                defaultValue={snapshot?.dsoDays ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor={`ar-nd-${companyId}`}>Not due</Label>
              <CurrencyInput id={`ar-nd-${companyId}`} name="notDue" type="number" step="0.01" defaultValue={snapshot?.notDue ?? 0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ar-30-${companyId}`}>1–30 days</Label>
              <CurrencyInput id={`ar-30-${companyId}`} name="days1To30" type="number" step="0.01" defaultValue={snapshot?.days1To30 ?? 0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ar-60-${companyId}`}>31–60 days</Label>
              <CurrencyInput id={`ar-60-${companyId}`} name="days31To60" type="number" step="0.01" defaultValue={snapshot?.days31To60 ?? 0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ar-90-${companyId}`}>61–90 days</Label>
              <CurrencyInput id={`ar-90-${companyId}`} name="days61To90" type="number" step="0.01" defaultValue={snapshot?.days61To90 ?? 0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ar-o90-${companyId}`}>Over 90 days</Label>
              <CurrencyInput id={`ar-o90-${companyId}`} name="over90" type="number" step="0.01" defaultValue={snapshot?.over90 ?? 0} />
            </div>
          </div>
          {state.error && (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p role="status" className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              {state.ok}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save receivables aging"}
            </Button>
          </div>
        </form>
        {snapshot && (
          <form action={clearCompanyReceivablesAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="snapshotId" value={snapshot.id} />
            <ConfirmButton
              message={`Clear the saved receivables aging snapshot for ${companyName}?`}
              variant="ghost"
              size="sm"
            >
              Clear snapshot
            </ConfirmButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}