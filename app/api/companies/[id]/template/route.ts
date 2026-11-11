import { apiGuard } from "@/lib/guard";
import { parsePositiveIntId } from "@/lib/input-validation";
import { connection } from "next/server";
import type ExcelJS from "exceljs";
import { listAccounts } from "@/lib/accounts";
import { getCompany } from "@/lib/companies";
import { isFigureSection, MONTHS, sectionName, templatePeriod } from "@/lib/company-data";
import { buildDailyTemplate, buildFigureTemplate, buildPnlTemplate, buildUnitsTemplate } from "@/lib/company-template";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const bad = (msg: string) => new Response(msg, { status: 400 });
const MONTHLY: Record<string, string> = { pnl: "P&L", daily: "Monthly sales report", units: "Unit types" };

/** Downloads an upload's Excel template: ?section=balance|budget|people&year=, ?section=sales with optional year=, or ?section=pnl|daily|units with optional year= and month= (0-11, default last month). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiGuard(req, "admin", "template", async () => {
    await connection();
    const q = new URL(req.url).searchParams;
    const section = q.get("section") ?? "";
    if (!(section in MONTHLY) && !isFigureSection(section) && section !== "sales") return bad("Unknown section.");
    const id = parsePositiveIntId((await params).id);
    if (!id) return new Response("Unknown company.", { status: 404 });
    const company = await getCompany(id);
    if (!company) return new Response("Unknown company.", { status: 404 });

    const send = async (wb: ExcelJS.Workbook, ...parts: (string | number)[]) => {
      const name = [company.name, ...parts].join("-").replace(/[^A-Za-z0-9]+/g, "-");
      return new Response(new Uint8Array(await wb.xlsx.writeBuffer()), { headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${name}.xlsx"`, "Cache-Control": "no-store" } });
    };
    if (section === "sales") {
      const period = templatePeriod(q.get("year"), null, new Date());
      return period ? send(buildFigureTemplate(company.name, section, period.year), sectionName(section), period.year) : bad("Unknown year.");
    }
    if (isFigureSection(section)) {
      const year = Number(q.get("year"));
      if (!Number.isInteger(year) || year < 2000 || year > 2100) return bad("Unknown year.");
      return send(buildFigureTemplate(company.name, section, year), sectionName(section), year);
    }
    const period = templatePeriod(q.get("year"), q.get("month"), new Date());
    if (!period) return bad("Unknown month or year.");
    const { year, month } = period;
    const wb = section === "pnl" ? buildPnlTemplate(year, month, await listAccounts())
      : section === "daily" ? buildDailyTemplate(year, month, company.total_rooms)
      : buildUnitsTemplate(year, month, company.room_types.map((r) => r.type));
    return send(wb, MONTHLY[section], MONTHS[month], year);
  });
}
