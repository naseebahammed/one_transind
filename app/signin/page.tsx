import { signIn } from "@/auth";

export const metadata = { title: "Sign in - One Transind" };

const box = { maxWidth: 360, margin: "20vh auto 0", padding: 32, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", textAlign: "center" } as const;
const button = { padding: "10px 20px", background: "var(--brand)", color: "var(--on-brand)", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer" } as const;

export default function SignIn() {
  return (
    <main style={box}>
      <h1 style={{ color: "var(--ink)", fontSize: 22, marginBottom: 8 }}>One Transind</h1>
      <p style={{ marginBottom: 24 }}>Sign in with your Transind Microsoft account.</p>
      {/* The destination is fixed to "/" on purpose: never take it from the address bar. */}
      <form action={async () => { "use server"; await signIn("microsoft-entra-id", { redirectTo: "/" }); }}>
        <button type="submit" style={button}>Sign in with Microsoft</button>
      </form>
    </main>
  );
}
