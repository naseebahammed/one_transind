"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/admin/ui/button";

export function SaveButton({
  children = "Save",
  pendingLabel = "Saving…",
  savedLabel = "Saved",
  showSavedState = true,
  disabled,
  className,
  ...props
}: {
  pendingLabel?: React.ReactNode;
  savedLabel?: React.ReactNode;
  showSavedState?: boolean;
} & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  const wasPendingRef = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      setSaved(false);
      return;
    }
    if (wasPendingRef.current && showSavedState) {
      wasPendingRef.current = false;
      setSaved(true);
      const timer = window.setTimeout(() => setSaved(false), 1800);
      return () => window.clearTimeout(timer);
    }
  }, [pending, showSavedState]);

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(saved && "border-success/40 text-success hover:text-success", className)}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {pendingLabel}
        </>
      ) : saved ? (
        <>
          <Check className="size-3.5 text-success" />
          {savedLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

