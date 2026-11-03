import { Suspense } from "react";
import "./admin.css";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Breadcrumbs } from "@/components/admin/Breadcrumbs";
import { listCompanies } from "@/lib/companies";
import { Separator } from "@/components/admin/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/admin/ui/sidebar";

export const metadata = { title: "Admin - One Transind" };

async function Sidebar() {
  return <AdminSidebar companies={(await listCompanies()).map((c) => ({ id: c.id, name: c.name }))} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin min-h-screen">
      <SidebarProvider>
        <Suspense><Sidebar /></Suspense>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card px-4">
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
