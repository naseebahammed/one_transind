import { SECTOR } from "@/lib/org";
import { SectorSales } from "@/components/SectorSales";

export const metadata = { title: "Health & Beauty · One Transind" };

export default function Page({ searchParams }: { searchParams: Promise<{ year?: string; company?: string }> }) {
  return <SectorSales searchParams={searchParams} sector={SECTOR.healthBeauty} path="/health-beauty" title="Health & Beauty" />;
}
