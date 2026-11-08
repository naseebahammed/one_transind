import { getCompanyLogo } from "@/lib/companies";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });
  const row = await getCompanyLogo(id);
  if (!row?.logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.logo), { headers: { "Content-Type": row.logo_type || "image/png", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600" } });
}
