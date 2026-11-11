import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/guard";
import { getSalesSectors } from "@/lib/sales-sectors";
import { SalesToolbar } from "@/components/SalesToolbar";
import { Nav, Title } from "@/components/Shell";
import { AskAI } from "@/components/AskAI";

async function Toolbar() {
  await connection();
  await requireUser();
  const sectors = (await getSalesSectors()).map(({ key, label }) => ({ key, label }));
  return <SalesToolbar sectors={sectors} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="rail">
        <div className="mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Transind Holding" />
          <b>One Transind</b>
        </div>
        <Nav />
      </aside>
      <div className="main">
        <div className="top">
          <Title />
          <Suspense fallback={null}><Toolbar /></Suspense>
        </div>
        <main className="content">{children}</main>
        <AskAI />
      </div>
    </div>
  );
}
