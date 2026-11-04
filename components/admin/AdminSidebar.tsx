"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, BookOpen, Building2, ExternalLink, Home, Layers, LayoutDashboard } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/admin/ui/sidebar";

const GROUPS = [
  { label: "Main", items: [{ href: "/admin", title: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Business",
    items: [
      { href: "/admin/companies", title: "Companies", icon: Building2 },
      { href: "/admin/sectors", title: "Sectors", icon: Layers },
      { href: "/admin/company-types", title: "Company types", icon: Home },
      { href: "/admin/sales-sectors", title: "Sales sectors", icon: Layers },
    ],
  },
  { label: "Finance", items: [{ href: "/admin/accounts", title: "Chart of accounts", icon: BookOpen }] },
  { label: "System", items: [{ href: "/admin/activity", title: "Activity log", icon: Activity }] },
];

export function AdminSidebar({ companies = [] }: { companies?: { id: number; name: string }[] }) {
  const path = usePathname();
  const selected = useSearchParams().get("company");
  const companyList = { label: "Company list", items: companies.map((c) => ({ href: `/admin/finance?company=${c.id}`, title: c.name, icon: Building2 })) };
  const groups = [...GROUPS.slice(0, 2), companyList, ...GROUPS.slice(2)];
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
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50">{g.label}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map(({ href, title, icon: Icon }) => (
                <SidebarMenuItem key={href + title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={title}
                    isActive={href === "/admin" ? path === href : href.startsWith("/admin/finance?") ? path === "/admin/finance" && href.endsWith(`=${selected}`) : path.startsWith(href)}
                    className="nav-item"
                  >
                    <Link href={href}><Icon />{title}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
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
