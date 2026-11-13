"use client";

import { Fragment, useState } from "react";
import { Check, Search, ShieldCheck, SlidersHorizontal, Trash2, X } from "lucide-react";
import { removeUserAction, setUserModulesAction } from "@/app/admin/users/actions";
import { ModulePicker } from "@/components/admin/AddUserForm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SaveButton } from "@/components/admin/SaveButton";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { cn } from "@/lib/cn";
import { MODULES } from "@/lib/modules";
import type { AppUser } from "@/lib/users";

type RoleFilter = "all" | "admin" | "user";

const MODULE_LABELS = new Map<string, string>(MODULES.map((m) => [m.area, m.label]));

function initialsFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").trim();
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "U";
}

function formatCreatedDate(raw: string): string {
  const datePart = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : raw;
}

function UserPermissionsEditor({
  user,
  onClose,
  onSaved,
}: {
  user: AppUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialCount = user.modules === null ? MODULES.length : user.modules.length;
  const [selectedCount, setSelectedCount] = useState(initialCount);
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={async (formData) => {
        if (formData.getAll("modules").length === 0) return;
        await setUserModulesAction(formData);
        onSaved();
      }}
      className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs"
    >
      <input type="hidden" name="email" value={user.email} />
      <ModulePicker
        selected={user.modules}
        onCountChange={(count, isDirty) => {
          setSelectedCount(count);
          setDirty(isDirty);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
        <div className="text-xs">
          {selectedCount === 0 ? (
            <span role="alert" className="font-medium text-destructive">
              Select at least one module — users with zero modules cannot sign in.
            </span>
          ) : dirty ? (
            <span className="text-warning">Unsaved permission changes</span>
          ) : (
            <span className="text-muted-foreground">Changes take effect on the person&apos;s next page load.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <SaveButton size="sm" disabled={selectedCount === 0} showSavedState={false}>
            Save permissions
          </SaveButton>
        </div>
      </div>
    </form>
  );
}

export function UsersDirectory({
  admins,
  users,
}: {
  admins: string[];
  users: AppUser[];
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  const totalCount = admins.length + users.length;
  const allModuleUsersCount = users.filter((u) => u.modules === null || u.modules.length >= MODULES.length).length;
  const scopedUsersCount = users.length - allModuleUsersCount;

  const needle = query.trim().toLowerCase();

  const shownAdmins =
    roleFilter === "user"
      ? []
      : admins.filter((email) => !needle || email.toLowerCase().includes(needle) || "admin administrator".includes(needle));

  const shownUsers =
    roleFilter === "admin"
      ? []
      : users.filter((u) => {
          if (!needle) return true;
          if (u.email.toLowerCase().includes(needle)) return true;
          const labels =
            u.modules === null
              ? "all modules"
              : u.modules.map((area) => MODULE_LABELS.get(area) ?? area).join(" ").toLowerCase();
          return labels.includes(needle);
        });

  const shownTotal = shownAdmins.length + shownUsers.length;
  const hasFilters = Boolean(needle || roleFilter !== "all");

  const markSaved = (email: string) => {
    setExpandedEmail(null);
    setSavedEmail(email);
    window.setTimeout(() => {
      setSavedEmail((curr) => (curr === email ? null : curr));
    }, 2500);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card
          compact
          className="cursor-pointer transition-colors hover:border-primary/40"
          onClick={() => setRoleFilter("all")}
        >
          <CardContent>
            <div className="text-xs text-muted-foreground">Authorized people</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">{totalCount}</div>
            <div className="text-xs text-muted-foreground">Microsoft Entra sign-in enabled</div>
          </CardContent>
        </Card>
        <Card
          compact
          className="cursor-pointer transition-colors hover:border-primary/40"
          onClick={() => setRoleFilter("admin")}
        >
          <CardContent>
            <div className="text-xs text-muted-foreground">Administrators</div>
            <div className="mt-0.5 text-2xl font-semibold text-info tabular-nums">{admins.length}</div>
            <div className="text-xs text-muted-foreground">All modules + Admin console</div>
          </CardContent>
        </Card>
        <Card
          compact
          className="cursor-pointer transition-colors hover:border-primary/40"
          onClick={() => setRoleFilter("user")}
        >
          <CardContent>
            <div className="text-xs text-muted-foreground">Standard users</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">{users.length}</div>
            <div className="text-xs text-muted-foreground">
              {allModuleUsersCount} full access · {scopedUsersCount} module-scoped
            </div>
          </CardContent>
        </Card>
      </div>

      <Card flush>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email or module…"
              aria-label="Search users"
              className="h-8 pr-8 pl-9"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div role="group" aria-label="Filter by role" className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {(
              [
                ["all", `All (${totalCount})`],
                ["admin", `Admins (${admins.length})`],
                ["user", `Users (${users.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={roleFilter === key}
                onClick={() => setRoleFilter(key)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  roleFilter === key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setRoleFilter("all");
              }}
            >
              Reset
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {hasFilters ? `Showing ${shownTotal} of ${totalCount}` : `${totalCount} ${totalCount === 1 ? "person" : "people"}`}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="w-32">Role</TableHead>
              <TableHead>Allowed modules</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shownAdmins.map((email) => (
              <TableRow key={`admin-${email}`}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-info-soft text-xs font-semibold text-info-soft-foreground"
                    >
                      {initialsFromEmail(email)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{email}</div>
                      <div className="text-xs text-muted-foreground">System administrator</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="info">
                    <ShieldCheck className="size-3" />
                    Admin
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="success">All {MODULES.length} modules</Badge>
                    <Badge variant="info">Admin console</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground" title="Configured in ADMIN_EMAILS server environment variable">
                  Set in ADMIN_EMAILS
                </TableCell>
              </TableRow>
            ))}

            {shownUsers.map((u) => {
              const isExpanded = expandedEmail === u.email;
              const isAllModules = u.modules === null || u.modules.length >= MODULES.length;
              const moduleLabels = (u.modules ?? []).map((area) => MODULE_LABELS.get(area) ?? area);
              const visibleLabels = moduleLabels.slice(0, 4);
              const hiddenCount = Math.max(0, moduleLabels.length - visibleLabels.length);

              return (
                <Fragment key={u.email}>
                  <TableRow className={cn(isExpanded && "border-b-0 bg-muted/30")}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                        >
                          {initialsFromEmail(u.email)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{u.email}</div>
                          <div className="text-xs text-muted-foreground">Added {formatCreatedDate(u.created)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">User</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isAllModules ? (
                          <Badge variant="success">All {MODULES.length} modules</Badge>
                        ) : moduleLabels.length === 0 ? (
                          <Badge variant="warning">No modules selected</Badge>
                        ) : (
                          <>
                            {visibleLabels.map((lbl) => (
                              <Badge key={lbl} variant="outline" className="bg-card font-normal text-foreground">
                                {lbl}
                              </Badge>
                            ))}
                            {hiddenCount > 0 && (
                              <button
                                type="button"
                                title={moduleLabels.join(", ")}
                                onClick={() => setExpandedEmail(isExpanded ? null : u.email)}
                                className="inline-flex items-center rounded-full bg-neutral-soft px-2 py-0.5 text-xs font-medium text-neutral-soft-foreground transition-colors hover:bg-info-soft hover:text-info-soft-foreground"
                              >
                                +{hiddenCount} more
                              </button>
                            )}
                          </>
                        )}
                        {savedEmail === u.email && (
                          <Badge variant="success">
                            <Check className="size-3" />
                            Saved
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={isExpanded ? "secondary" : "outline"}
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedEmail(isExpanded ? null : u.email)}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          {isExpanded ? "Close" : "Permissions"}
                        </Button>
                        <form action={removeUserAction} className="inline-flex">
                          <input type="hidden" name="email" value={u.email} />
                          <ConfirmButton
                            message={`Remove ${u.email}? They will lose access on their next page load.`}
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove ${u.email}`}
                            title="Remove user"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 />
                          </ConfirmButton>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow className="bg-muted/25 hover:bg-muted/25">
                      <TableCell colSpan={4} className="px-4 pt-1 pb-4 whitespace-normal">
                        <UserPermissionsEditor
                          key={`${u.email}-${JSON.stringify(u.modules)}`}
                          user={u}
                          onClose={() => setExpandedEmail(null)}
                          onSaved={() => markSaved(u.email)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}

            {shownTotal === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {totalCount > 0 ? "No people match your search." : "No users configured yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

