import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/admin/ui/skeleton";

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
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Live>{children}</Live>
      </Suspense>
    </>
  );
}

async function Live({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}
