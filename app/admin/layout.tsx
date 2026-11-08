import { Suspense } from "react";
import { requireUser } from "@/lib/guard";
import "./admin.css";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Breadcrumbs } from "@/components/admin/Breadcrumbs";
import { listCompanies } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";
import { Separator } from "@/components/admin/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/admin/ui/sidebar";

export const metadata = { title: "Admin - One Transind" };

async function Sidebar() {
  const [companies, sectors] = await Promise.all([listCompanies(), listSectors()]);
  const sectorName = new Map(sectors);
  return <AdminSidebar companies={companies.map((c) => ({ id: c.id, name: c.name, sector: sectorName.get(c.sector) ?? c.sector }))} />;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="admin min-h-screen">
      <SidebarProvider>
        <Suspense><div className="print:hidden"><Sidebar /></div></Suspense>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card px-4 print:hidden">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <Suspense><Breadcrumbs /></Suspense>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
