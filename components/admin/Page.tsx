import { requireAdmin } from "@/lib/guard";
import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/admin/ui/skeleton";

function AdminPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page content">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="ml-auto h-5 w-24" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="ml-auto h-3.5 w-16" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// DB reads are per-request; wait on the connection inside Suspense so the shell can still prerender.
export function Page({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <Suspense fallback={<AdminPageSkeleton />}>
        <Live>{children}</Live>
      </Suspense>
    </>
  );
}

async function Live({ children }: { children: React.ReactNode }) {
  await connection();
  await requireAdmin();
  return children;
}
