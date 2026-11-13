"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mail, UserPlus } from "lucide-react";
import { addUserAction, type UserState } from "@/app/admin/users/actions";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { cn } from "@/lib/cn";
import { MODULES } from "@/lib/modules";

export const MODULE_PRESETS: { key: string; label: string; areas: readonly string[] }[] = [
  {
    key: "all",
    label: "All modules",
    areas: MODULES.map((m) => m.area),
  },
  {
    key: "finance",
    label: "Finance",
    areas: ["dashboard", "finance", "sales", "customers"],
  },
  {
    key: "operations",
    label: "Operations",
    areas: ["dashboard", "sales", "trading", "restaurants", "real-estate", "health-beauty", "retail", "logistics", "sectors"],
  },
  {
    key: "hr",
    label: "HR",
    areas: ["dashboard", "hr"],
  },
];

function initialSet(selected: readonly string[] | null): Set<string> {
  if (selected === null) return new Set(MODULES.map((m) => m.area));
  return new Set(MODULES.map((m) => m.area).filter((area) => selected.includes(area)));
}

/** Tactile pill picker for the pages a person may open (`selected` null = every module). */
export function ModulePicker({
  selected,
  onCountChange,
  disabled = false,
}: {
  selected: readonly string[] | null;
  onCountChange?: (count: number, dirty: boolean) => void;
  disabled?: boolean;
}) {
  const baseline = initialSet(selected);
  const [picked, setPicked] = useState<Set<string>>(() => initialSet(selected));

  const notify = (next: Set<string>) => {
    if (!onCountChange) return;
    const dirty =
      next.size !== baseline.size || [...next].some((area) => !baseline.has(area));
    onCountChange(next.size, dirty);
  };

  const toggleArea = (area: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(area)) next.add(area);
      notify(next);
      return next;
    });
  };

  const applyAreas = (areas: readonly string[]) => {
    const next = new Set(areas);
    setPicked(next);
    notify(next);
  };

  const sameAs = (areas: readonly string[]) =>
    picked.size === areas.length && areas.every((a) => picked.has(a));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Presets:</span>
          {MODULE_PRESETS.map((preset) => {
            const active = sameAs(preset.areas);
            return (
              <button
                key={preset.key}
                type="button"
                disabled={disabled}
                onClick={() => applyAreas(preset.areas)}
                className={cn(
                  "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-primary/40 bg-info-soft text-info-soft-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
          {picked.size > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyAreas([])}
              className="inline-flex h-6 items-center rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Clear
            </button>
          )}
        </div>
        <Badge variant={picked.size === 0 ? "warning" : picked.size === MODULES.length ? "success" : "info"}>
          {picked.size} of {MODULES.length} selected
        </Badge>
      </div>

      <fieldset disabled={disabled} className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Modules this person can open</legend>
        {MODULES.map((m) => {
          const checked = picked.has(m.area);
          return (
            <label
              key={m.area}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors select-none",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                disabled && "pointer-events-none opacity-50",
                checked
                  ? "border-primary/45 bg-info-soft/65 text-info-soft-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <input
                type="checkbox"
                name="modules"
                value={m.area}
                checked={checked}
                onChange={() => toggleArea(m.area)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-3.5 items-center justify-center rounded-[4px] border transition-colors",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                )}
              >
                {checked && <Check className="size-2.5 stroke-[3]" />}
              </span>
              <span>{m.label}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

const DEFAULT_INVITE_MODULES = ["dashboard", "sales", "finance", "customers"] as const;

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, {} as UserState);
  const [email, setEmail] = useState("");
  const [pickerVersion, setPickerVersion] = useState(0);
  const [selectedCount, setSelectedCount] = useState<number>(DEFAULT_INVITE_MODULES.length);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const submittedEmailRef = useRef("");
  const prevStateRef = useRef<UserState>(state);

  useEffect(() => {
    if (prevStateRef.current === state) return;
    prevStateRef.current = state;
    if (!state.error && submittedEmailRef.current) {
      const added = submittedEmailRef.current;
      submittedEmailRef.current = "";
      setJustAdded(added);
      setEmail("");
      setPickerVersion((v) => v + 1);
      setSelectedCount(DEFAULT_INVITE_MODULES.length);
      const timer = window.setTimeout(() => setJustAdded(null), 3500);
      return () => window.clearTimeout(timer);
    }
  }, [state]);

  return (
    <Card compact>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-info-soft text-info-soft-foreground">
            <UserPlus className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm">Grant user access</CardTitle>
            <CardDescription className="text-xs">
              Add a colleague&apos;s Microsoft email and select which pages they can view.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) => {
            submittedEmailRef.current = String(formData.get("email") ?? "").trim().toLowerCase();
            setJustAdded(null);
            action(formData);
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="email"
                type="email"
                required
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@transindgroup.com"
                aria-label="Microsoft email address"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={pending || selectedCount === 0}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Grant access
                </>
              )}
            </Button>
            {selectedCount === 0 && (
              <span className="text-xs text-warning">Select at least one module below.</span>
            )}
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            {justAdded && !state.error && (
              <p role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
                <Check className="size-4" />
                Access granted to <strong className="font-medium">{justAdded}</strong>
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <ModulePicker
              key={pickerVersion}
              selected={DEFAULT_INVITE_MODULES}
              disabled={pending}
              onCountChange={(count) => setSelectedCount(count)}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
