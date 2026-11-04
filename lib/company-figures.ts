import { numbering, q } from "@/lib/db";
import type { Figure, FigureSection } from "@/lib/company-data";

export const listFigures = (companyId: number, section: FigureSection, year: number) =>
  q<Figure>("SELECT year, month, line, value::float8 AS value FROM app.company_figures WHERE company_id=$1 AND section=$2 AND year=$3", [companyId, section, year]);

/** All or nothing, so a failed upload never leaves half a file saved. Months not in the file stay as they are. */
export const saveFigures = (companyId: number, section: FigureSection, figures: Figure[]) =>
  numbering(async (c) => {
    for (const f of figures) {
      await c.query(
        `INSERT INTO app.company_figures(company_id,section,year,month,line,value) VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT (company_id,section,year,month,line) DO UPDATE SET value=EXCLUDED.value, updated=now()`,
        [companyId, section, f.year, f.month, f.line, f.value]);
    }
  });

export const deleteFigureMonth = (companyId: number, section: FigureSection, year: number, month: number) =>
  q("DELETE FROM app.company_figures WHERE company_id=$1 AND section=$2 AND year=$3 AND month=$4", [companyId, section, year, month]);

/** Which months of a year each section has on file. */
export async function listFilledMonths(companyId: number, year: number) {
  const out: Record<FigureSection, Set<number>> = { balance: new Set(), budget: new Set(), people: new Set() };
  for (const r of await q<{ section: FigureSection; month: number }>("SELECT DISTINCT section, month FROM app.company_figures WHERE company_id=$1 AND year=$2", [companyId, year])) out[r.section]?.add(r.month);
  return out;
}
