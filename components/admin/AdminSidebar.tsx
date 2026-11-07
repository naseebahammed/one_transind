"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, BookOpen, Building2, ChevronRight, ClipboardCheck, ExternalLink, Home, Layers } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, useSidebar,
} from "@/components/admin/ui/sidebar";

type SidebarCompany = { id: number; name: string; sector: string };

const GROUPS = [
  {
    label: "Business",
    items: [
      { href: "/admin/companies", title: "Companies", icon: Building2 },
      { href: "/admin/data-status", title: "Data status", icon: ClipboardCheck },
      { href: "/admin/sectors", title: "Sectors", icon: Layers },
      { href: "/admin/company-types", title: "Company types", icon: Home },
      { href: "/admin/sales-sectors", title: "Sales sectors", icon: Layers },
    ],
  },
  { label: "Finance", items: [{ href: "/admin/accounts", title: "Chart of accounts", icon: BookOpen }] },
  { label: "System", items: [{ href: "/admin/activity", title: "Activity log", icon: Activity }] },
];

/** Companies under one collapsible row per sector; the selected company's sector starts open. */
function CompanyList({ companies, selected }: { companies: SidebarCompany[]; selected: string | null }) {
  const { state, setOpen: setSidebarOpen } = useSidebar();
  const selectedSector = companies.find((c) => String(c.id) === selected)?.sector;
  const [open, setOpen] = useState(() => new Set(selectedSector ? [selectedSector] : []));
  const [prevSector, setPrevSector] = useState(selectedSector);
  if (prevSector !== selectedSector) { // arriving at a company from elsewhere reveals it
    setPrevSector(selectedSector);
    if (selectedSector) setOpen((s) => new Set(s).add(selectedSector));
  }
  const toggle = (sector: string) => setOpen((s) => {
    const next = new Set(s);
    if (!next.delete(sector)) next.add(sector);
    return next;
  });
  const sectors = [...new Set(companies.map((c) => c.sector))].sort((a, b) => a.localeCompare(b));
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50">Company list</SidebarGroupLabel>
      <SidebarMenu>
        {sectors.map((sector) => {
          const isOpen = open.has(sector);
          return (
            <SidebarMenuItem key={sector}>
              <SidebarMenuButton
                tooltip={sector}
                aria-expanded={isOpen}
                isActive={!isOpen && sector === selectedSector}
                className="nav-item"
                onClick={() => {
                  // Sub-items are hidden on the icon rail, so expand the sidebar to show them.
                  if (state === "collapsed") { setSidebarOpen(true); setOpen((s) => new Set(s).add(sector)); }
                  else toggle(sector);
                }}
              >
                <Layers />
                <span className="truncate">{sector}</span>
                <ChevronRight className={`ml-auto transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </SidebarMenuButton>
              {isOpen && (
                <SidebarMenuSub>
                  {companies.filter((c) => c.sector === sector).map((c) => (
                    <SidebarMenuSubItem key={c.id}>
                      <SidebarMenuSubButton asChild isActive={String(c.id) === selected} className="nav-item">
                        <Link href={`/admin/finance?company=${c.id}`}><span>{c.name}</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AdminSidebar({ companies = [] }: { companies?: SidebarCompany[] }) {
  const path = usePathname();
  const selected = useSearchParams().get("company");
  const navGroup = (g: (typeof GROUPS)[number]) => (
    <SidebarGroup key={g.label}>
      <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50">{g.label}</SidebarGroupLabel>
      <SidebarMenu>
        {g.items.map(({ href, title, icon: Icon }) => (
          <SidebarMenuItem key={href + title}>
            <SidebarMenuButton
              asChild
              tooltip={title}
              isActive={path.startsWith(href)}
              className="nav-item"
            >
              <Link href={href}><Icon />{title}</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-3 border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt="" className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-1 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" />
        <div className="leading-tight group-data-[collapsible=icon]:hidden">
          <div className="font-semibold text-white">One Transind</div>
          <div className="text-xs text-sidebar-foreground/60">Admin console</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.slice(0, 1).map(navGroup)}
        <CompanyList companies={companies} selected={path === "/admin/finance" ? selected : null} />
        {GROUPS.slice(1).map(navGroup)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to main app">
              <Link href="/sales"><ExternalLink />Back to main app</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
