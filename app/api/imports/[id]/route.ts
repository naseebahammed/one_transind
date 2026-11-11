import { apiGuard } from "@/lib/guard";
import { connection } from "next/server";
import { getImportFile } from "@/lib/company-figures";

/** Downloads the original file of an upload. Sent as an attachment with a fixed safe type, so an uploaded file can never run in the browser. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard("admin");
  if (denied) return denied;
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Unknown upload.", { status: 404 });
  const r = await getImportFile(id);
  if (!r?.file) return new Response("Unknown upload.", { status: 404 });
  const name = r.file_name.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(new Uint8Array(r.file), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
}
