import type { Metadata } from "next";
import { Almarai, IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { LANGUAGE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = { title: "One Transind" };

const almarai = Almarai({ subsets: ["arabic"], weight: ["700", "800"], variable: "--font-almarai", display: "swap" });
const ibmPlexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-ibm-plex-arabic", display: "swap" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-ibm-plex-mono", display: "swap" });

// Layouts stay synchronous (see guard-coverage.test.ts), so the page direction comes from the language cookie in a tiny script that runs before first paint.
const APPLY_LANGUAGE = `if(/(^|; )${LANGUAGE_COOKIE}=ar/.test(document.cookie)){document.documentElement.lang="ar";document.documentElement.dir="rtl"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${almarai.variable} ${ibmPlexArabic.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_LANGUAGE }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
