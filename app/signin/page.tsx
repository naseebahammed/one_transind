import { signIn } from "@/auth";
import { devLoginEnabled } from "@/lib/access";

export const metadata = { title: "Sign in - One Transind" };

const css = `
.si { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); background: var(--bg); }
.si-brand { display: flex; flex-direction: column; justify-content: space-between; padding: 48px 56px;
  background: linear-gradient(160deg, #101a44 0%, #0a1130 60%, #060a18 100%); border-right: 1px solid var(--line); }
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
          <form action={async () => { "use server"; await signIn("microsoft-entra-id", { redirectTo: "/" }); }}>
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
          {devLoginEnabled(process.env) && (
            <form action={async (f: FormData) => { "use server"; await signIn("credentials", { email: String(f.get("email") ?? ""), redirectTo: "/" }); }} style={{ marginTop: 24 }}>
              <p className="si-note" style={{ marginTop: 0, marginBottom: 8 }}>Development only: test login (never shown in production).</p>
              <input name="email" type="email" required placeholder="email on the approved list" aria-label="Test login email" className="si-btn" style={{ marginBottom: 8, fontWeight: 400 }} />
              <button type="submit" className="si-btn">Test sign in</button>
            </form>
          )}
          <p className="si-note">If you are approved but cannot sign in, contact an administrator.</p>
        </div>
      </section>
    </main>
  );
}
