import { apiGuard } from "@/lib/guard";
import { getCompanyLogo } from "@/lib/companies";
import { SAFE_LOGO_TYPES } from "@/lib/companies.shared";
import { parsePositiveIntId } from "@/lib/input-validation";
import { inspectLogoUpload } from "@/lib/upload-security";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(req, "admin", "logo", async () => {
    const id = parsePositiveIntId((await params).id);
    if (!id) return new Response(null, { status: 404 });
    const row = await getCompanyLogo(id);
    if (!row?.logo) return new Response(null, { status: 404 });
    const verified = inspectLogoUpload(row.logo);
    if (!verified.ok) return new Response(null, { status: 404 });
    const contentType = SAFE_LOGO_TYPES.has(verified.mimeType) ? verified.mimeType : "image/png";
    return new Response(new Uint8Array(row.logo), {
      headers: {
        "Content-Type": contentType,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
        Vary: "Cookie",
      },
    });
  });
}
