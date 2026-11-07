"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/admin/ui/button";

export function ConfirmButton({ message, disabled, ...props }: { message: string } & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="destructive" disabled={disabled || pending} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }} {...props} />;
}
