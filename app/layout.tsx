import type { Metadata } from "next";
import "./globals.css";
import { LANGUAGE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = { title: "One Transind" };

// Layouts stay synchronous (see guard-coverage.test.ts), so the page direction comes from the language cookie in a tiny script that runs before first paint.
const APPLY_LANGUAGE = `if(/(^|; )${LANGUAGE_COOKIE}=ar/.test(document.cookie)){document.documentElement.lang="ar";document.documentElement.dir="rtl"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_LANGUAGE }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
