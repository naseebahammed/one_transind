"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/admin/ui/button";

export function PrintButton() {
  return (
    <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" />
      Print
    </Button>
  );
}
