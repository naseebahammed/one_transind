"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const NAMES: Record<string, string> = { admin: "Dashboard", companies: "Companies", accounts: "Chart of accounts", sectors: "Sectors", "sales-sectors": "Sales sectors", finance: "Finance", "al-manzil": "Al Manzil 2024 vs 2025", activity: "Activity log", new: "New" };

export function Breadcrumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  const crumbs = parts.map((p, i) => ({ href: "/" + parts.slice(0, i + 1).join("/"), name: NAMES[p] ?? "Edit" }));
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5" />}
          {i === crumbs.length - 1 ? <span className="font-medium text-foreground">{c.name}</span> : <Link href={c.href} className="hover:text-foreground">{c.name}</Link>}
        </span>
      ))}
    </nav>
  );
}
