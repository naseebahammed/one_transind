"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, BarChart3, BookOpen, Building2, ChevronRight, ClipboardCheck, ExternalLink, Home, Layers, PenLine, Search, Upload, Users, X, type LucideIcon } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail, useSidebar,
} from "@/components/admin/ui/sidebar";

type SidebarCompany = { id: number; name: string; sector: string };

export type AdminSidebarUser = {
  name: string;
  email: string;
  initials: string;
  showEmail: boolean;
};

type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  exactWhenCompanySelected?: boolean;
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Business",
    items: [
      { href: "/admin/companies", title: "Companies", icon: Building2 },
      { href: "/admin/imports", title: "Import center", icon: Upload },
      { href: "/admin/data-status", title: "Data status", icon: ClipboardCheck },
      { href: "/admin/manual-entry", title: "Manual data entry", icon: PenLine },
      { href: "/admin/sectors", title: "Sectors", icon: Layers },
      { href: "/admin/company-types", title: "Company types", icon: Home },
      { href: "/admin/sales-sectors", title: "Sales sectors", icon: Layers },
      { href: "/admin/employees", title: "Staff lists", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/finance", title: "Finance overview", icon: BarChart3, exactWhenCompanySelected: true },
      { href: "/admin/accounts", title: "Chart of accounts", icon: BookOpen },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/activity", title: "Activity log", icon: Activity },
      { href: "/admin/users", title: "Users", icon: Users },
    ],
  },
];

/** Companies under one collapsible row per sector; the selected company's sector starts open. */
function CompanyList({ companies, selected, query = "" }: { companies: SidebarCompany[]; selected: string | null; query?: string }) {
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
  const needle = query.trim().toLowerCase();
  const filteredCompanies = needle
    ? companies.filter((c) => c.name.toLowerCase().includes(needle) || c.sector.toLowerCase().includes(needle))
    : companies;
  const sectors = [...new Set(filteredCompanies.map((c) => c.sector))].sort((a, b) => a.localeCompare(b));
  if (!sectors.length) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50">Company list</SidebarGroupLabel>
      <SidebarMenu>
        {sectors.map((sector) => {
          const isOpen = Boolean(needle) || open.has(sector);
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
                  {filteredCompanies.filter((c) => c.sector === sector).map((c) => (
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

function SidebarFrame({
  companies = [],
  selected = null,
  user,
  signOutSlot,
}: {
  companies?: SidebarCompany[];
  selected?: string | null;
  user?: AdminSidebarUser;
  signOutSlot?: React.ReactNode;
}) {
  const path = usePathname();
  const { setOpen: setSidebarOpen } = useSidebar();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSidebarOpen]);

  const needle = query.trim().toLowerCase();
  const filteredGroups = GROUPS.map((g) => ({
    ...g,
    items: needle ? g.items.filter((item) => item.title.toLowerCase().includes(needle) || g.label.toLowerCase().includes(needle)) : g.items,
  }));
  const hasMatchingCompanies = needle
    ? companies.some((c) => c.name.toLowerCase().includes(needle) || c.sector.toLowerCase().includes(needle))
    : companies.length > 0;
  const hasAnyMatch = filteredGroups.some((g) => g.items.length > 0) || hasMatchingCompanies;

  const navGroup = (g: (typeof GROUPS)[number]) => {
    if (!g.items.length) return null;
    return (
      <SidebarGroup key={g.label}>
        <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50">{g.label}</SidebarGroupLabel>
        <SidebarMenu>
          {g.items.map(({ href, title, icon: Icon, exactWhenCompanySelected }) => {
            const active = exactWhenCompanySelected ? path.startsWith(href) && !selected : path.startsWith(href);
            return (
              <SidebarMenuItem key={href + title}>
                <SidebarMenuButton
                  asChild
                  tooltip={title}
                  isActive={active}
                  className="nav-item"
                >
                  <Link href={href}><Icon />{title}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    );
  };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
        <Link href="/admin" className="flex items-center gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="" className="h-9 w-9 shrink-0 rounded-md bg-card object-contain p-1 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" />
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <div className="font-semibold text-sidebar-accent-foreground">One Transind</div>
            <div className="text-xs text-sidebar-foreground/60">Admin console</div>
          </div>
        </Link>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/50" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape" && query) { e.stopPropagation(); setQuery(""); } }}
            placeholder="Filter menu or company..."
            aria-label="Filter menu or company"
            className="h-8 w-full rounded-md border border-sidebar-border/80 bg-sidebar-accent/35 pr-7 pl-8 text-xs text-sidebar-accent-foreground placeholder:text-sidebar-foreground/50 outline-none focus-visible:border-sidebar-ring focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(""); searchRef.current?.focus(); }}
              aria-label="Clear filter"
              className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-sidebar-border/80 px-1 text-[10px] font-medium text-sidebar-foreground/50">Ctrl K</kbd>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {filteredGroups.slice(0, 1).map(navGroup)}
        <CompanyList companies={companies} selected={path === "/admin/finance" ? selected : null} query={query} />
        {filteredGroups.slice(1).map(navGroup)}
        {needle && !hasAnyMatch && (
          <p className="px-4 py-6 text-center text-xs text-sidebar-foreground/55">No matches for &ldquo;{query.trim()}&rdquo;</p>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-1.5 border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to executive app" className="nav-item">
              <Link href="/dashboard"><ExternalLink />Back to main app</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {user && (
          <div
            className="flex items-center gap-2.5 rounded-md border border-sidebar-border/80 bg-sidebar-accent/35 px-2.5 py-2 text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
            title={user.showEmail ? `${user.name} (${user.email})` : user.name}
          >
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/25 text-xs font-semibold text-sidebar-accent-foreground"
            >
              {user.initials}
            </span>
            <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <div className="truncate text-xs font-semibold text-sidebar-accent-foreground">{user.name}</div>
              {user.showEmail && <div className="truncate text-[11px] text-sidebar-foreground/65">{user.email}</div>}
            </div>
            <div className="shrink-0 group-data-[collapsible=icon]:hidden">{signOutSlot}</div>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Static shell used as the Suspense fallback so the 16rem sidebar never jumps on initial stream. */
export function AdminSidebarFallback() {
  return <SidebarFrame />;
}

export function AdminSidebar({
  companies = [],
  user,
  signOutSlot,
}: {
  companies?: SidebarCompany[];
  user?: AdminSidebarUser;
  signOutSlot?: React.ReactNode;
}) {
  const selected = useSearchParams().get("company");
  return <SidebarFrame companies={companies} selected={selected} user={user} signOutSlot={signOutSlot} />;
}
