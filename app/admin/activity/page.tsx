import { Page } from "@/components/admin/Page";
import { Badge } from "@/components/admin/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listImports } from "@/lib/company-figures";
import { listLog } from "@/lib/db";

export default function Activity() {
  return (
    <Page title="Activity log" description="Recent uploads, edits and system jobs.">
      <h2 className="text-sm font-semibold">Uploads</h2>
      <ImportTable />
      <h2 className="text-sm font-semibold">Jobs and edits</h2>
      <LogTable />
    </Page>
  );
}

async function ImportTable() {
  const rows = await listImports();
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Time</TableHead><TableHead>Company</TableHead><TableHead>Report</TableHead><TableHead>File</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Rows</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono">{r.created}</TableCell>
            <TableCell>{r.company}</TableCell>
            <TableCell>{r.section}{r.source !== "upload" && ` (${r.source})`}</TableCell>
            <TableCell>{r.has_file ? <a className="underline" href={`/api/imports/${r.id}`}>{r.file_name}</a> : r.file_name}</TableCell>
            <TableCell>{r.period_from === r.period_to ? r.period_from ?? "-" : `${r.period_from} to ${r.period_to}`}</TableCell>
            <TableCell>
              <Badge variant={r.status === "loaded" ? "success" : "danger"}>{r.status === "loaded" ? "Loaded" : "Rejected"}</Badge>
              {r.error && <p className="mt-1 max-w-md whitespace-normal text-xs text-muted-foreground">{r.error}</p>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{r.rows_loaded}</TableCell>
          </TableRow>
        ))}
        {!rows.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No uploads yet.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

async function LogTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Time</TableHead><TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Records</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {(await listLog()).map((l, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono">{l.t}</TableCell>
            <TableCell>{l.job}</TableCell>
            <TableCell><Badge variant={l.ok ? "success" : "danger"}>{l.ok ? "OK" : "Failed"}</Badge></TableCell>
            <TableCell className="text-right tabular-nums">{l.n}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
