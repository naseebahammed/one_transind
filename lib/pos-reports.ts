// Reads the monthly retail POS reports exported from the shop system (Dukan Foods and Top Perfumes): daily sales, item sales with cost (COFO), purchases and stock.
// Pure (no database) so `node --test` can load it. The company, the report type and the month are read from the report's own heading lines, never from the file name.
// Amounts in QAR as the report prints them: cost is positive for a sale and negative for a return, so margin is sales minus cost.
// Customer names and mobile numbers in the item reports are deliberately not read.
import { cellDate, num } from "./report-parsers.ts";

export type PosReportKind = "daily_sales" | "item_sales" | "purchases" | "stock";
type Row = Record<string, string | number | null | Record<string, number>>;
type FieldType = "text" | "num" | "date";
// [field, header (lower case), type, optional]. A field marked optional may be missing from a month's layout.
type Field = readonly [string, string, FieldType, boolean?];
type Spec = { kind: PosReportKind; title: RegExp; fields: readonly Field[]; check: string; tenders?: boolean };

const SPECS: readonly Spec[] = [
  { kind: "daily_sales", title: /sales and sr register/, check: "billAmount", tenders: true,
    fields: [["saleDate", "date", "date"], ["tranType", "transaction type", "text"], ["qty", "total qty", "num"], ["billAmount", "bill amount", "num"], ["userName", "user name", "text", true]] },
  { kind: "daily_sales", title: /datewise sales and sr summary/, check: "billAmount", tenders: true,
    fields: [["location", "locationname", "text"], ["saleDate", "bill dt.", "date"], ["tranType", "trantype", "text"], ["bills", "no of bills", "num", true], ["qty", "total qty", "num"], ["gross", "item gross", "num", true],
      ["itemDiscount", "item discount", "num", true], ["billDiscount", "bill discount", "num", true], ["net", "item netamt", "num", true], ["billAmount", "bill amount", "num"]] },
  { kind: "item_sales", title: /sales - book margin/, check: "sales",
    fields: [["itemCode", "item code", "text"], ["itemName", "item name", "text"], ["sales", "sales", "num"], ["tax", "sales tax (gst)", "num", true], ["qty", "sold qty", "num"], ["cost", "purchase", "num"]] },
  { kind: "item_sales", title: /customer - bill - itemwise margin/, check: "sales",
    fields: [["location", "locationname", "text"], ["billNo", "bill no.", "text"], ["billDate", "bill date", "date"], ["itemCode", "item code", "text"], ["itemName", "item name", "text"], ["qty", "qty", "num"], ["freeQty", "free qty", "num", true],
      ["sales", "net sales less disc", "num"], ["discount", "manual discount", "num", true], ["cost", "net cost (without tax)", "num"], ["distributor", "distributor name", "text", true]] },
  { kind: "purchases", title: /purchase - invoice wise/, check: "netAmount",
    fields: [["supplier", "supplier name", "text"], ["amount", "gross amount", "num", true], ["qty", "total received qty", "num", true], ["freeQty", "total free quantity", "num", true], ["netAmount", "bill amount", "num"],
      ["tax", "rst tax amt", "num", true], ["invoiceDate", "bill  date", "date", true], ["invoiceNo", "bill no", "text", true], ["paymentType", "payment type", "text", true], ["purchaseDate", "purchase date", "date"]] },
  { kind: "purchases", title: /purchase detail - itemwise/, check: "netAmount",
    fields: [["location", "locationname", "text"], ["purchaseNo", "purchase no.", "text"], ["purchaseDate", "purchase date", "date"], ["invoiceNo", "invoice no.", "text", true], ["invoiceDate", "invoice dt.", "date", true], ["supplier", "dist. name", "text"],
      ["itemCode", "item code", "text"], ["itemName", "item name", "text"], ["qty", "quantity", "num"], ["freeQty", "free", "num", true], ["unitCost", "pur price", "num", true], ["sellingPrice", "selling", "num", true],
      ["amount", "item amount", "num", true], ["netAmount", "item net amount", "num"], ["expiryDate", "expiry dt.", "date", true]] },
  { kind: "stock", title: /current stock - item wise/, check: "valueCost",
    fields: [["itemName", "item name", "text"], ["closing", "stock", "num"], ["uom", "uom", "text", true], ["valueCost", "stock amount", "num"], ["valueSelling", "stock selling amount", "num", true], ["ean", "item ean code", "text", true]] },
  { kind: "stock", title: /current stock \(as on/, check: "valueCost",
    fields: [["location", "location", "text"], ["mfr", "mfr. name", "text", true], ["itemCode", "item code", "text"], ["itemName", "item name", "text"], ["ean", "ean code", "text", true], ["opening", "opening qty", "num", true],
      ["inQty", "stock in qty", "num", true], ["outQty", "stock out qty", "num", true], ["closing", "closing qty", "num"], ["valueCost", "stk value on purprice", "num"], ["valueSelling", "stk value on selling", "num", true], ["status", "status", "text", true]] },
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const text = (v: unknown) => (typeof v === "number" ? String(v) : String(v ?? "").replace(/\s+/g, " ").trim());
const head = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** "04-Oct-2026" text, an Excel serial number, or any date the shared reader knows, as "YYYY-MM-DD"; null when blank. */
function dateOf(v: unknown, where: string): string | null {
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{4})$/), month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
    if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (v === null || v === undefined || text(v) === "") return null;
  const iso = cellDate(v as never, where);
  if (!iso) throw new Error(`${where}: "${text(v)}" is not a date.`);
  return iso;
}

export type PosReport = { entity: string; kind: PosReportKind; period: string; rows: Row[]; errors: string[] };

/** One report workbook (its first sheet as rows of cells). Anything unrecognised, or rows that do not add up to the report's own total, comes back as errors so the file is refused whole. */
export function parsePosReport(grid: unknown[][]): PosReport {
  const fail = (error: string): PosReport => ({ entity: "", kind: "daily_sales", period: "", rows: [], errors: [error] });
  const top = grid.slice(0, 5).map((r) => r.map(text).filter(Boolean).join(" "));
  const heading = top.join(" ").toLowerCase();
  const spec = SPECS.find((s) => s.title.test(heading));
  if (!spec) return fail("Not a recognised Dukan or Top Perfumes report (daily sales, item sales, purchases or stock).");
  const entity = grid.slice(0, 4).flat().map(text).find((t) => /^[A-Z][A-Z &.-]{3,60}$/.test(t) && !/^DATE/.test(t));
  if (!entity) return fail("The company name was not found in the first lines of the report.");
  const range = heading.match(/from (\d{1,2})-([a-z]{3})[a-z]*-(\d{4}) (\d{1,2})-([a-z]{3})[a-z]*-(\d{4})/);
  if (!range) return fail('No "DATE : from ... to ..." line found, so the month is unknown.');
  if (range[2] !== range[5] || range[3] !== range[6] || MONTHS.indexOf(range[2]) < 0) return fail("The report covers more than one calendar month. Export one month at a time.");
  const period = `${range[3]}-${String(MONTHS.indexOf(range[2]) + 1).padStart(2, "0")}-01`;

  // Newer layouts number the rows (S.No) and end with a total line; older ones have no S.No and show the total as the first data row, so a row counts as data when its first field is filled.
  const headerAt = grid.findIndex((r, i) => i < 8 && r.some((c) => head(c) === "s.no" || head(c) === spec.fields[0][1]));
  if (headerAt < 0) return fail("The column heading row was not found.");
  const headings = grid[headerAt].map(head);
  const columns = new Map<string, number>(), missing: string[] = [];
  for (const [field, header, , optional] of spec.fields) {
    const at = headings.indexOf(header);
    if (at >= 0) columns.set(field, at); else if (!optional) missing.push(`"${header}"`);
  }
  if (missing.length) return fail(`Missing columns: ${missing.join(", ")}.`);
  const serial = headings.indexOf("s.no"), firstField = columns.get(spec.fields[0][0])!;
  const tenderFrom = Math.max(...columns.values()) + 1; // every column after the last known one is a payment method (Cash, Credit Card, ...)

  const errors: string[] = [], rows: Row[] = [];
  const isData = (r: unknown[]) => (serial >= 0 ? typeof r[serial] === "number" : text(r[firstField]) !== "");
  const checkColumn = columns.get(spec.check)!;
  let totalFromSheet: number | null = null;
  grid.slice(headerAt + 1).forEach((r, i) => {
    const where = `Row ${headerAt + i + 2}`;
    if (!isData(r)) {
      const total = r[checkColumn]; // the report's own total line: no serial number (or, in the item book, no item code)
      if (totalFromSheet === null && typeof total === "number") totalFromSheet = total;
      return;
    }
    try {
      const row: Row = {};
      for (const [field, , type] of spec.fields) {
        const at = columns.get(field);
        const cell = at === undefined ? null : r[at];
        row[field] = type === "num" ? num(cell as never, `${where} ${field}`) : type === "date" ? dateOf(cell, `${where} ${field}`) : text(cell) || null;
        if (row[field] === null && !spec.fields.find((f) => f[0] === field)![3]) throw new Error(`${where}: ${field} is empty.`);
      }
      if (spec.tenders) {
        const tenders: Record<string, number> = {};
        headings.forEach((name, at) => { const amount = at >= tenderFrom && name ? num(r[at] as never, `${where} ${name}`) : null; if (amount) tenders[text(grid[headerAt][at])] = amount; });
        row.tenders = tenders;
      }
      rows.push(row);
    } catch (e) { errors.push((e as Error).message); }
  });
  if (!rows.length) errors.push("The report has no data rows.");
  const added = Math.round(rows.reduce((a, r) => a + (Number(r[spec.check]) || 0), 0) * 100) / 100;
  if (!errors.length && totalFromSheet !== null && Math.abs(added - totalFromSheet) > 1) errors.push(`The rows add up to ${added} but the report's own total says ${totalFromSheet}.`);
  return { entity, kind: spec.kind, period, rows, errors };
}
