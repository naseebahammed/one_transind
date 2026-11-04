import { getCompanyLogo } from "@/lib/companies";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const row = await getCompanyLogo(Number((await params).id));
  if (!row?.logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.logo), { headers: { "Content-Type": row.logo_type || "image/png", "Cache-Control": "private, max-age=3600" } });
}
