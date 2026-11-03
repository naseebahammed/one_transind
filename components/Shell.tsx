"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const PAGES = [
  { href: "/sales", title: "Sales", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { href: "/trading", title: "Trading sales (actual)", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/dashboard", title: "Group dashboard", icon: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z" },
  { href: "/restaurants", title: "Restaurants", icon: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" },
  { href: "/customers", title: "Customers", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/hr", title: "Human resources", icon: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" },
  { href: "/real-estate", title: "Real Estate", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01" },
  { href: "/logistics", title: "Logistics", icon: "M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  { href: "/finance", title: "Finance", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {PAGES.map((p) => (
        <Link key={p.href} href={p.href} aria-current={path.startsWith(p.href) ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={p.icon} />
          </svg>
          {p.title}
        </Link>
      ))}
    </nav>
  );
}

export function Title() {
  const path = usePathname();
  return <h1>{PAGES.find((p) => path.startsWith(p.href))?.title ?? "One Transind"}</h1>;
}
