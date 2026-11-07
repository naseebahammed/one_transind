"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { TableCell, TableRow } from "@/components/admin/ui/table";
import type { Company } from "@/lib/companies";
import { fmt } from "@/lib/format";

export function CompanyRow({ company: c, sectorLabel, expenses = [] }: { company: Company; sectorLabel: string; expenses?: (number | null)[] }) {
  const router = useRouter();
  return (
    <TableRow onClick={() => router.push(`/admin/companies/${c.id}`)} className="cursor-pointer">
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          {c.has_logo && <img src={`/api/companies/${c.id}/logo`} alt="" className="size-6 rounded border object-contain" />}
          {c.name}
        </span>
      </TableCell>
      <TableCell><Badge variant="outline">{sectorLabel}</Badge></TableCell>
      <TableCell className="text-muted-foreground">{c.property_type ? c.property_type[0].toUpperCase() + c.property_type.slice(1) : "—"}</TableCell>
      <TableCell><Badge variant={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge></TableCell>
      {expenses.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{v === null ? "—" : fmt(Math.abs(v), 2)}</TableCell>)}
      <TableCell className="text-right">
        <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}><Link href={`/admin/companies/${c.id}`}>Edit</Link></Button>
      </TableCell>
    </TableRow>
  );
}
