import { connection } from "next/server";
import { listAccounts } from "@/lib/accounts";
import { getCompany } from "@/lib/companies";
import { isFigureSection, MONTHS, SECTIONS } from "@/lib/company-data";
import { buildFigureTemplate, buildPnlTemplate } from "@/lib/company-template";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const bad = (msg: string) => new Response(msg, { status: 400 });

/** Downloads a section's Excel template: ?section=balance|budget|people&year=, or ?section=pnl&year=&month= (month 0-11). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const q = new URL(req.url).searchParams;
  const section = q.get("section") ?? "", year = Number(q.get("year")), month = Number(q.get("month") ?? NaN);
  if (section !== "pnl" && !isFigureSection(section)) return bad("Unknown section.");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return bad("Unknown year.");
  if (section === "pnl" && !(Number.isInteger(month) && month >= 0 && month <= 11)) return bad("Unknown month.");
  const company = await getCompany(Number((await params).id));
  if (!company) return new Response("Unknown company.", { status: 404 });

  const wb = section === "pnl" ? buildPnlTemplate(year, month, await listAccounts()) : buildFigureTemplate(company.name, section, year);
  const label = SECTIONS.find(([k]) => k === section)![1];
  const name = [company.name, label, section === "pnl" ? MONTHS[month] : "", year].filter(Boolean).join("-").replace(/[^A-Za-z0-9]+/g, "-");
  return new Response(new Uint8Array(await wb.xlsx.writeBuffer()), { headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${name}.xlsx"`, "Cache-Control": "no-store" } });
}
