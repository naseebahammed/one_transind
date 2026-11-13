import { signOut } from "@/auth";
import { allowPublicAction } from "@/lib/guard";

export const metadata = { title: "No access - One Transind" };

const box = { maxWidth: 400, margin: "20vh auto 0", padding: 32, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", textAlign: "center" } as const;
const button = { padding: "10px 20px", background: "transparent", color: "var(--ink)", border: "1px solid var(--line-strong)", borderRadius: 8, cursor: "pointer" } as const;

export default function NoAccess() {
  return (
    <main style={box}>
      <h1 style={{ color: "var(--ink)", fontSize: 22, marginBottom: 8 }}>No access</h1>
      <p style={{ marginBottom: 24 }}>Your account is not approved for this page. Ask an administrator to give you access.</p>
      <form action={async () => { "use server"; if (!(await allowPublicAction("signout"))) return; await signOut({ redirectTo: "/signin" }); }}>
        <button type="submit" style={button}>Sign out</button>
      </form>
    </main>
  );
}
