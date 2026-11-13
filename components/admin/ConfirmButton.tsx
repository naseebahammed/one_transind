"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";

function inferConfirmVerb(message: string): string {
  const match = /^(Delete|Remove|Clear)\b/i.exec(message.trim());
  if (!match) return "Confirm";
  const word = match[1];
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function ConfirmButton({
  message,
  confirmTitle = "Please confirm",
  confirmLabel,
  variant = "destructive",
  disabled,
  onClick,
  name,
  value,
  ...props
}: {
  message: string;
  confirmTitle?: string;
  confirmLabel?: string;
} & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const actionLabel = confirmLabel ?? inferConfirmVerb(message);

  return (
    <>
      <button
        ref={submitRef}
        type="submit"
        name={name}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant={variant}
            disabled={disabled || pending}
            onClick={(e) => {
              onClick?.(e);
              if (e.defaultPrevented) return;
            }}
            {...props}
          />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-soft-foreground"
              >
                <AlertTriangle className="size-4" />
              </span>
              <div className="space-y-1">
                <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
                <AlertDialogDescription>{message}</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setOpen(false);
                const form = submitRef.current?.form;
                if (form) form.requestSubmit(submitRef.current ?? undefined);
              }}
            >
              {pending ? "Working..." : actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
