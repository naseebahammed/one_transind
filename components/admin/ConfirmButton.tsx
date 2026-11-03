"use client";
import { Button } from "@/components/admin/ui/button";

export function ConfirmButton({ message, ...props }: { message: string } & React.ComponentProps<typeof Button>) {
  return <Button type="submit" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }} {...props} />;
}
