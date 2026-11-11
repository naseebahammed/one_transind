import { apiGuard } from "@/lib/guard";
import { parsePositiveIntId } from "@/lib/input-validation";
import { sanitizeUploadFileName } from "@/lib/upload-security";
import { connection } from "next/server";
import { getImportFile } from "@/lib/company-figures";

/** Downloads the original file of an upload. Sent as an attachment with a fixed safe type, so an uploaded file can never run in the browser. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(req, "admin", "importDownload", async () => {
    await connection();
    const id = parsePositiveIntId((await params).id);
    if (!id) return new Response("Unknown upload.", { status: 404 });
    const r = await getImportFile(id);
    if (!r?.file) return new Response("Unknown upload.", { status: 404 });
    const name = sanitizeUploadFileName(r.file_name).replace(/[^A-Za-z0-9._-]+/g, "-");
    return new Response(new Uint8Array(r.file), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  });
}
