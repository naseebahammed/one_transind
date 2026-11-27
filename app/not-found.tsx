import Link from "next/link";

export const metadata = { title: "Page not found - One Transind" };

const box = {
  maxWidth: 420,
  margin: "20vh auto 0",
  padding: 32,
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r)",
  textAlign: "center",
} as const;

const linkStyle = {
  display: "inline-block",
  padding: "10px 20px",
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: 8,
  textDecoration: "none",
} as const;

export default function NotFound() {
  return (
    <main style={box}>
      <h1 style={{ color: "var(--ink)", fontSize: 22, marginBottom: 8 }}>Page not found</h1>
      <p style={{ marginBottom: 24 }}>The page you requested does not exist or may have moved.</p>
      <Link href="/" style={linkStyle}>Back to home</Link>
    </main>
  );
}
