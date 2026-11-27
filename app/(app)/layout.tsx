import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { signOut } from "@/auth";
import { userDisplayName, userInitials } from "@/lib/access";
import { allowPublicAction, requireUser } from "@/lib/guard";
import { translator } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";
import { listMenuSectors, listSectors } from "@/lib/sectors";
import { SalesToolbar } from "@/components/SalesToolbar";
import { Nav, NavShell, Title } from "@/components/Shell";
import { AskAI } from "@/components/AskAI";
import { FollowMode } from "@/components/FollowMode";

async function Toolbar() {
  await connection();
  await requireUser();
  const [rawSectors, language] = await Promise.all([listSectors(), getLanguage()]);
  const sectors = rawSectors.map(([key, name]) => ({ key, name }));
  return <SalesToolbar sectors={sectors} language={language} />;
}

// Sectors added in admin appear in the menu and page title; the plain versions render until they load.
async function MenuNav() {
  await connection();
  const { modules } = await requireUser();
  const [sectors, language] = await Promise.all([listMenuSectors(), getLanguage()]);
  return <Nav sectors={sectors} language={language} areas={modules} />;
}

async function MenuTitle() {
  await connection();
  await requireUser();
  const [sectors, language] = await Promise.all([listMenuSectors(), getLanguage()]);
  return <Title sectors={sectors} language={language} />;
}

async function SidebarUser() {
  await connection();
  const { email, name, role } = await requireUser();
  const translate = translator(await getLanguage());
  const logOut = translate("Log out");
  const adminLabel = translate("Admin console");
  const userName = userDisplayName(name, email);
  const initials = userInitials(name, email);
  const showEmail = userName.toLowerCase() !== email.toLowerCase();
  const tooltip = showEmail ? userName + " (" + email + ")" : userName;
  return (
    <div className="rail-user">
      {role === "admin" && (
        <Link href="/admin" className="rail-admin-link" title={adminLabel} aria-label={adminLabel}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="lbl">{adminLabel}</span>
        </Link>
      )}
      <div className="rail-who" title={tooltip}>
        <span className="rail-avatar" aria-hidden="true">{initials}</span>
        <div className="rail-meta">
          <span className="rail-name">{userName}</span>
          {showEmail && <span className="rail-email">{email}</span>}
        </div>
      </div>
      {/* Sign-out clears the session cookie even if approval was revoked mid-session. */}
      <form action={async () => { "use server"; if (!(await allowPublicAction("signout"))) return; await signOut({ redirectTo: "/signin" }); }}>
        <button type="submit" className="rail-logout" title={logOut} aria-label={logOut}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span className="lbl">{logOut}</span>
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside className="rail">
        <Link href="/dashboard" className="mark" aria-label="One Transind">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Transind Holding" />
          <b>One Transind</b>
        </Link>
        <Suspense fallback={<Suspense fallback={<NavShell />}><Nav /></Suspense>}><MenuNav /></Suspense>
        <Suspense fallback={null}><SidebarUser /></Suspense>
      </aside>
      <div className="main">
        <div className="top">
          <Suspense fallback={<Suspense fallback={<h1>One Transind</h1>}><Title /></Suspense>}><MenuTitle /></Suspense>
          <Suspense fallback={null}><FollowMode /></Suspense>
          <Suspense fallback={null}><Toolbar /></Suspense>
        </div>
        <main id="main-content" className="content">{children}</main>
        <AskAI />
      </div>
    </div>
  );
}
