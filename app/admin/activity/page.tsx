import { ActivityLogView } from "@/components/admin/ActivityLogView";
import { Page } from "@/components/admin/Page";
import { listImports } from "@/lib/company-figures";
import { listLog } from "@/lib/db";

export default function Activity() {
  return (
    <Page title="Activity log" description="Recent uploads, edits and system jobs.">
      <Content />
    </Page>
  );
}

async function Content() {
  const [imports, logs] = await Promise.all([listImports(), listLog()]);
  return <ActivityLogView imports={imports} logs={logs} />;
}
