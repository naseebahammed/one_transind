"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { TableCell, TableRow } from "@/components/admin/ui/table";
import type { Company } from "@/lib/companies";
import { fmt } from "@/lib/format";

export function CompanyRow({ company: c, sectorLabel, propertyTypeLabel, expenses = [] }: { company: Company; sectorLabel: string; propertyTypeLabel?: string; expenses?: (number | null)[] }) {
  const router = useRouter();
  const detailHref = `/admin/companies/${c.id}`;
  return (
    <TableRow
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          window.open(detailHref, "_blank", "noopener,noreferrer");
          return;
        }
        router.push(detailHref);
      }}
      className="cursor-pointer"
    >
      <TableCell className="admin-sticky-col font-medium">
        <Link
          href={detailHref}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-2.5 rounded-xs hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {c.has_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/companies/${c.id}/logo`} alt="" className="size-6 shrink-0 rounded-sm border bg-card object-contain p-0.5" />
          )}
          <span>{c.name}</span>
        </Link>
      </TableCell>
      <TableCell><Badge variant="outline">{sectorLabel}</Badge></TableCell>
      <TableCell className="text-muted-foreground">{propertyTypeLabel ?? (c.property_type ? c.property_type[0].toUpperCase() + c.property_type.slice(1) : "—")}</TableCell>
      <TableCell><Badge variant={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Inactive"}</Badge></TableCell>
      {expenses.map((v, i) => <TableCell key={i} className="text-right tabular-nums">{v === null ? "—" : fmt(Math.abs(v), 2)}</TableCell>)}
      <TableCell className="text-right">
        <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
          <Link href={detailHref}>Edit</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
