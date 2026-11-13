import { notFound } from "next/navigation";
import { connection } from "next/server";
import { listSectors } from "@/lib/sectors";
import { SECTOR } from "@/lib/org";
import { SectorSales } from "@/components/SectorSales";

export const metadata = { title: "Sectors · One Transind" };

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ year?: string; company?: string }> }) {
  await connection(); // sectors are added in admin, so the list must not be baked in at build time
  const { key } = await params;
  const name = (await listSectors()).find(([k]) => k === key)?.[1];
  if (!name) notFound();
  return <SectorSales searchParams={searchParams} sector={key} path={`/sectors/${key}`} title={name} kind={key === SECTOR.facilityManagement ? "pnl" : "sales"} />;
}
