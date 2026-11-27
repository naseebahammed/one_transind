import { Suspense } from "react";
import { connection } from "next/server";
import { signIn } from "@/auth";
import { allowPublicAction } from "@/lib/guard";
import { issueBotChallenge } from "@/lib/rate-limit";
import { hasAdminPasswordLogin, isDevLoginEnabled } from "@/lib/server-config";

export const metadata = { title: "Sign in - One Transind" };

const honeypotStyle = {
  position: "absolute",
  left: -9999,
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: "none",
} as const;

const css = `
.si { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); background: var(--bg); }
.si-brand { display: flex; flex-direction: column; justify-content: space-between; padding: 48px 56px;
  background: linear-gradient(160deg, #101a44 0%, #0a1130 60%, #060a18 100%); border-inline-end: 1px solid var(--line); }
.si-logo { width: 60%; max-width: 320px; max-height: 160px; margin: 0 auto; object-fit: contain; }
.si-foot { font-size: 12px; color: var(--muted); }
.si-main { display: grid; place-items: center; padding: 32px 24px; }
.si-form { width: 100%; max-width: 380px; }
.si-pill { display: inline-block; margin-bottom: 14px; padding: 4px 10px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--brand); background: var(--brand-soft); border-radius: 999px; }
.si-title { color: var(--ink); font-size: 26px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 8px; }
.si-sub { font-size: 14px; line-height: 1.5; margin-bottom: 28px; }
.si-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 20px;
  background: var(--panel); color: var(--ink); border: 1px solid var(--line-strong); border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
  transition: background .15s, border-color .15s; }
.si-btn:hover { background: var(--panel-2); border-color: var(--brand); }
.si-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.si-alt { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line); position: relative; }
.si-input { width: 100%; display: block; padding: 10px 12px; margin-bottom: 10px; background: var(--panel-2); color: var(--ink);
  border: 1px solid var(--line-strong); border-radius: 8px; font-size: 14px; line-height: 1.4; text-align: start; transition: border-color .15s, box-shadow .15s; }
.si-input::placeholder { color: var(--muted); }
.si-input:hover { border-color: rgba(140, 160, 255, .42); }
.si-input:focus-visible { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.si-note { margin-top: 24px; font-size: 12px; line-height: 1.5; color: var(--muted); }
.si-mobile-logo { display: none; }
@media (max-width: 860px) {
  .si { grid-template-columns: 1fr; }
  .si-brand { display: none; }
  .si-mobile-logo { display: block; height: 36px; margin-bottom: 28px; object-fit: contain; }
}
`;

export default function SignIn() {
  return (
    <main className="si">
      <style>{css}</style>
      <section className="si-brand">
        <span />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="si-logo" src="/logo.webp" alt="Transind" />
        <p className="si-foot">Transind Holding. Internal use only.</p>
      </section>
      <section className="si-main">
        <div className="si-form">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="si-mobile-logo" src="/logo.webp" alt="Transind" />
          <span className="si-pill">Private system</span>
          <h1 className="si-title">Sign in</h1>
          <p className="si-sub">Restricted to approved Transind staff. Use your Transind Microsoft account.</p>
          {/* The destination is fixed to "/" on purpose: never take it from the address bar. */}
          <form action={async () => { "use server"; if (!(await allowPublicAction("signin"))) return; await signIn("microsoft-entra-id", { redirectTo: "/" }); }}>
            <button type="submit" className="si-btn">
              <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
                <rect width="10" height="10" fill="#f25022" />
                <rect x="11" width="10" height="10" fill="#7fba00" />
                <rect y="11" width="10" height="10" fill="#00a4ef" />
                <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>
          </form>
          <Suspense fallback={null}>
            <OptionalSignInForms />
          </Suspense>
          <p className="si-note">If you are approved but cannot sign in, contact an administrator.</p>
        </div>
      </section>
    </main>
  );
}

async function OptionalSignInForms() {
  await connection();
  const showAdminPassword = hasAdminPasswordLogin();
  const showDevLogin = isDevLoginEnabled();
  if (!showAdminPassword && !showDevLogin) return null;
  const adminChallenge = showAdminPassword ? issueBotChallenge() : "";
  const devChallenge = showDevLogin ? issueBotChallenge() : "";
  return (
    <>
      {showAdminPassword && (
        <form action={async (f: FormData) => { "use server"; if (!(await allowPublicAction("signin"))) return; if (!hasAdminPasswordLogin()) return; await signIn("admin-password", { email: String(f.get("email") ?? ""), password: String(f.get("password") ?? ""), formToken: String(f.get("formToken") ?? ""), website: String(f.get("website") ?? ""), redirectTo: "/" }); }} className="si-alt">
          <p className="si-note" style={{ marginTop: 0, marginBottom: 10 }}>Temporary administrator sign-in.</p>
          <input type="hidden" name="formToken" value={adminChallenge} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={honeypotStyle} />
          <input name="email" type="email" required autoComplete="email" placeholder="Admin email" aria-label="Admin email" className="si-input" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Password" aria-label="Admin password" className="si-input" />
          <button type="submit" className="si-btn">Admin sign in</button>
        </form>
      )}
      {showDevLogin && (
        <form action={async (f: FormData) => { "use server"; if (!(await allowPublicAction("signin"))) return; if (!isDevLoginEnabled()) return; await signIn("credentials", { email: String(f.get("email") ?? ""), formToken: String(f.get("formToken") ?? ""), website: String(f.get("website") ?? ""), redirectTo: "/" }); }} className="si-alt">
          <p className="si-note" style={{ marginTop: 0, marginBottom: 10 }}>Development only: test login (never shown in production).</p>
          <input type="hidden" name="formToken" value={devChallenge} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={honeypotStyle} />
          <input name="email" type="email" required autoComplete="email" placeholder="Email on the approved list" aria-label="Test login email" className="si-input" />
          <button type="submit" className="si-btn">Test sign in</button>
        </form>
      )}
    </>
  );
}
