import { SectorSales } from "@/components/SectorSales";

export const metadata = { title: "Hypermarkets & Retail · One Transind" };

export default function Page({ searchParams }: { searchParams: Promise<{ year?: string; company?: string }> }) {
  return <SectorSales searchParams={searchParams} sector="retail" path="/retail" title="Hypermarkets & Retail" />;
}
