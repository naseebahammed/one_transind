import { Page } from "@/components/admin/Page";
import { tone } from "@/components/admin/tones";
import { Badge } from "@/components/admin/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { listLog } from "@/lib/db";

export default function Activity() {
  return <Page title="Activity log" description="Recent system and integration jobs."><LogTable /></Page>;
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
            <TableCell><Badge className={l.ok ? tone.green : tone.red}>{l.ok ? "OK" : "Failed"}</Badge></TableCell>
            <TableCell className="text-right tabular-nums">{l.n}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
