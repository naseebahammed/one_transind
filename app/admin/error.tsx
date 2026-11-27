"use client";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin page error:", error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border bg-card p-6 text-center shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This admin page could not load. Please try again, or return to the admin overview.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <a
          href="/admin"
          className="inline-flex items-center rounded-md border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Admin overview
        </a>
      </div>
    </div>
  );
}
