import { Suspense } from "react";
import { connection } from "next/server";
import { signOut } from "@/auth";
import { userDisplayName, userInitials } from "@/lib/access";
import { allowPublicAction, requireUser } from "@/lib/guard";
import { listMenuSectors, listSectors } from "@/lib/sectors";
import { SalesToolbar } from "@/components/SalesToolbar";
import { Nav, Title } from "@/components/Shell";
import { AskAI } from "@/components/AskAI";

async function Toolbar() {
  await connection();
  await requireUser();
  const sectors = (await listSectors()).map(([key, name]) => ({ key, name }));
  return <SalesToolbar sectors={sectors} />;
}

// Sectors added in admin appear in the menu and page title; the plain versions render until they load.
async function MenuNav() {
  await connection();
  await requireUser();
  return <Nav sectors={await listMenuSectors()} />;
}

async function MenuTitle() {
  await connection();
  await requireUser();
  return <Title sectors={await listMenuSectors()} />;
}

async function SidebarUser() {
  await connection();
  const { email, name } = await requireUser();
  const userName = userDisplayName(name, email);
  const initials = userInitials(name, email);
  const showEmail = userName.toLowerCase() !== email.toLowerCase();
  const tooltip = showEmail ? userName + " (" + email + ")" : userName;
  return (
    <div className="rail-user">
      <div className="rail-who" title={tooltip}>
        <span className="rail-avatar" aria-hidden="true">{initials}</span>
        <div className="rail-meta">
          <span className="rail-name">{userName}</span>
          {showEmail && <span className="rail-email">{email}</span>}
        </div>
      </div>
      {/* Sign-out clears the session cookie even if approval was revoked mid-session. */}
      <form action={async () => { "use server"; if (!(await allowPublicAction("signout"))) return; await signOut({ redirectTo: "/signin" }); }}>
        <button type="submit" className="rail-logout" title="Log out" aria-label="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span className="lbl">Log out</span>
        </button>
      </form>
    </div>
  );
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
        <Suspense fallback={<Nav />}><MenuNav /></Suspense>
        <Suspense fallback={null}><SidebarUser /></Suspense>
      </aside>
      <div className="main">
        <div className="top">
          <Suspense fallback={<Title />}><MenuTitle /></Suspense>
          <Suspense fallback={null}><Toolbar /></Suspense>
        </div>
        <main className="content">{children}</main>
        <AskAI />
      </div>
    </div>
  );
}
