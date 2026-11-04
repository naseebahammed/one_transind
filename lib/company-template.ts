// Excel side of the company page's sections: builds the templates to send out and reads uploaded ones into a grid for parseGrid.
import ExcelJS from "exceljs";
import { LINES, MONTHS, templateTitle, type Cell, type FigureSection } from "./company-data.ts";

export function buildFigureTemplate(company: string, section: FigureSection, year: number) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Data");
  ws.addRow([templateTitle(company, section, year)]).font = { bold: true };
  ws.addRow(["Line", ...MONTHS]).font = { bold: true };
  for (const line of LINES[section]) ws.addRow([line]);
  ws.getColumn(1).width = 34;
  return wb;
}

/** Same layout uploadPnl reads. One month only: uploadPnl stores a blank as 0 for every month column in the file, so a 12-month template would wipe the other months. */
export function buildPnlTemplate(year: number, month: number, accounts: { main: string; sub: string }[]) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("P&L");
  ws.getCell("A1").value = "Main account";
  ws.getCell("D1").value = "Account";
  ws.getCell("E1").value = `${MONTHS[month]}-${year}`;
  ws.getRow(1).font = { bold: true };
  accounts.forEach((a, i) => { ws.getCell(i + 3, 1).value = a.main; ws.getCell(i + 3, 4).value = a.sub; });
  ws.getColumn(1).width = 30; ws.getColumn(4).width = 34;
  return wb;
}

/** A cell's real value: formula cells give their result, blank gives null (never 0), and anything that is not a number or text becomes text for the validator to reject. */
function readCell(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object" && "result" in v) return readCell(v.result as ExcelJS.CellValue);
  if (typeof v === "object" && "formula" in v) return null; // a formula Excel never calculated has no value yet
  if (typeof v === "object" && "richText" in v) return v.richText.map((x) => x.text).join("");
  return v instanceof Date ? v.toISOString() : String(Object(v).error ?? v);
}

/** The first visible sheet as rows of cells, 0-indexed. */
export function gridFromWorkbook(wb: ExcelJS.Workbook): Cell[][] {
  const ws = wb.worksheets.find((w) => w.state === "visible");
  if (!ws) return [];
  const grid: Cell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: Cell[] = [];
    for (let c = 1; c <= Math.max(ws.columnCount, 13); c++) row.push(readCell(ws.getCell(r, c).value));
    grid.push(row);
  }
  return grid;
}
