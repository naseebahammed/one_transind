import Link from "next/link";
import { Page } from "@/components/admin/Page";
import { ImportCenter } from "@/components/admin/ImportCenter";
import { Button } from "@/components/admin/ui/button";
import { listCompanies } from "@/lib/companies";
import { listSectors } from "@/lib/sectors";

export default function ImportsPage() {
  return (
    <Page
      title="Import center"
      description="Upload Excel and CSV workbooks for companies, finance, retail, logistics, and HR in one place."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/admin/data-status">Data status</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/manual-entry">Manual data entry</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/activity">Activity log</Link></Button>
        </div>
      }
    >
      <Body />
    </Page>
  );
}

async function Body() {
  const [companies, sectors] = await Promise.all([listCompanies(), listSectors()]);
  const sectorMap = new Map(sectors);
  const active = companies
    .filter((c) => c.active && !c.hidden)
    .map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      sectorName: sectorMap.get(c.sector) ?? c.sector,
    }))
    .sort((a, b) => a.sectorName.localeCompare(b.sectorName) || a.name.localeCompare(b.name));

  return <ImportCenter companies={active} />;
}
