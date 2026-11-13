import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/guard";
import { listSectors } from "@/lib/sectors";
import { SECTOR } from "@/lib/org";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SectorSales } from "@/components/SectorSales";

export const metadata = { title: "Sectors · One Transind" };

type Params = Promise<{ key: string }>;
type Search = Promise<{ year?: string; company?: string }>;

export default function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton kpis={4} hasFilters panels={2} />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: { params: Params; searchParams: Search }) {
  await connection(); // sectors are added in admin, so the list must not be baked in at build time
  await requireUser("sectors");
  const { key } = await params;
  const name = (await listSectors()).find(([k]) => k === key)?.[1];
  if (!name) notFound();
  return <SectorSales searchParams={searchParams} sector={key} path={`/sectors/${key}`} title={name} kind={key === SECTOR.facilityManagement ? "pnl" : "sales"} />;
}
