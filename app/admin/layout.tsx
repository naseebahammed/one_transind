import { Suspense } from "react";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import "./admin.css";
import { AdminSidebar, AdminSidebarFallback } from "@/components/admin/AdminSidebar";
import { Breadcrumbs, BreadcrumbsFallback } from "@/components/admin/Breadcrumbs";
import { userDisplayName, userInitials } from "@/lib/access";
import { listCompanies } from "@/lib/companies";
import { allowPublicAction, requireAdmin } from "@/lib/guard";
import { listSectors } from "@/lib/sectors";
import { Separator } from "@/components/admin/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/admin/ui/sidebar";

export const metadata = { title: "Admin - One Transind" };

async function Sidebar() {
  await connection();
  const { email, name } = await requireAdmin();
  const [companies, sectors] = await Promise.all([listCompanies(), listSectors()]);
  const sectorName = new Map(sectors);
  const displayName = userDisplayName(name, email);
  const initials = userInitials(name, email);
  const showEmail = displayName.toLowerCase() !== email.toLowerCase();

  const signOutForm = (
    <form
      action={async () => {
        "use server";
        if (!(await allowPublicAction("signout"))) return;
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button
        type="submit"
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        <LogOut className="size-3.5" />
      </button>
    </form>
  );

  return (
    <AdminSidebar
      companies={companies.map((c) => ({ id: c.id, name: c.name, sector: sectorName.get(c.sector) ?? c.sector }))}
      user={{ name: displayName, email, initials, showEmail }}
      signOutSlot={signOutForm}
    />
  );
}

async function HeaderBreadcrumbs() {
  await connection();
  await requireAdmin();
  const [companies, sectors] = await Promise.all([listCompanies(), listSectors()]);
  return (
    <Breadcrumbs
      companies={companies.map((c) => [String(c.id), c.name])}
      sectors={sectors}
    />
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin min-h-screen">
      <SidebarProvider>
        <Suspense fallback={<div className="print:hidden"><Suspense fallback={null}><AdminSidebarFallback /></Suspense></div>}>
          <div className="print:hidden"><Sidebar /></div>
        </Suspense>
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur-xs print:hidden">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <Suspense fallback={<Suspense fallback={null}><BreadcrumbsFallback /></Suspense>}><HeaderBreadcrumbs /></Suspense>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
