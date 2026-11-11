import { apiGuard } from "@/lib/guard";
import { getCompanyLogo } from "@/lib/companies";
import { SAFE_LOGO_TYPES } from "@/lib/companies.shared";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard("admin");
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 404 });
  const row = await getCompanyLogo(id);
  if (!row?.logo) return new Response(null, { status: 404 });
  const contentType = SAFE_LOGO_TYPES.has(row.logo_type) ? row.logo_type : "image/png";
  return new Response(new Uint8Array(row.logo), { headers: { "Content-Type": contentType, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600" } });
}
