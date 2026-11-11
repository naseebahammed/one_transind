// Reads the FMCG control reports into rows: delivery variance (ordered vs delivered), consignment receipts and product expiry ageing.
// Pure (no database) so `node --test` can load it. Sheets are found by their headings because two of these files name them Sheet2 or by date.
import type ExcelJS from "exceljs";

import { eachRow, findTable, text } from "./fmcg-masters.ts";
import { roundMoney, sumMoney } from "./money.ts";
import { cellDate, formatDateCell, num, type ImportIssue } from "./report-parsers.ts";

export type Variance = { doDate: string; doNo: string; itemCode: string; location: string; customerCode: string | null; customer: string | null; salesman: string | null; storeInCharge: string | null; driver: string | null; item: string | null; brand: string | null; manager: string | null; supervisor: string | null; qtyRv: number; qtyDo: number; valueRv: number; valueDo: number };
export type Consignment = { receivedDate: string; lineNo: number; consignmentNo: string; orderNo: string | null; invoiceNo: string | null; invoiceDate: string | null; supplier: string | null; location: string | null; itemCode: string; item: string | null; expiryDate: string | null; excise: string | null; billedQty: number; receivedQty: number };
export type Expiry = { lineNo: number; itemCode: string; item: string | null; size: string | null; packing: string | null; brand: string | null; category: string | null; location: string | null; cartons: number | null; outers: number | null; pieces: number | null; totalCost: number; expiryDate: string; remarks: string | null };

const orNull = (v: string) => v || null;

/** Name of the first sheet with all these headings in its first rows. */
function sheetWith(wb: ExcelJS.Workbook, headings: string[]) {
  const wanted = headings.map((h) => h.toLowerCase());
  return wb.worksheets.find((ws) => {
    for (let i = 1; i <= 6; i++) {
      const seen: string[] = [];
      ws.getRow(i).eachCell((c) => seen.push(text(c.value).toLowerCase()));
      if (wanted.every((h) => seen.includes(h))) return true;
    }
    return false;
  })?.name;
}

/** Whichever control report the workbook holds. A row that cannot be read is reported and left out; the rest still load. */
export function controlFromWorkbook(wb: ExcelJS.Workbook) {
  const issues: ImportIssue[] = [], variances: Variance[] = [], consignments: Consignment[] = [], expiry: Expiry[] = [];
  let expiryDate: string | null = null, expiryReport: string | null = null, controlTotal: number | null = null;

  const varianceSheet = sheetWith(wb, ["DO No", "Qty (RV)", "Qty (DO)"]);
  if (varianceSheet) {
    const t = findTable(wb, varianceSheet, "DO No", ["DO Date", "Customer Code", "Customer", "Salesman", "LOC Code", "Store In Charge", "Driver", "Item Code", "Item Desc", "Qty (RV)", "Qty (DO)", "Invoice Amount(RV)", "Invoice Amount(DO)", "BRAND", "Manager", "Supervisors"])!;
    eachRow(t, (cell, row, i) => {
      const doNo = cell("DO No");
      if (!doNo) return;
      const where = `${t.sheet}, row ${i}`;
      try {
        const doDate = cellDate(row.getCell(t.column("DO Date")).value, where), itemCode = cell("Item Code"), location = cell("LOC Code");
        if (!doDate || !itemCode || !location) throw new Error(`${where}: no date, item or warehouse.`);
        const figure = (h: string) => num(row.getCell(t.column(h)).value, `${where}, ${h}`) ?? 0;
        variances.push({ doDate, doNo, itemCode, location, customerCode: orNull(cell("Customer Code")), customer: orNull(cell("Customer")), salesman: orNull(cell("Salesman")), storeInCharge: orNull(cell("Store In Charge")), driver: orNull(cell("Driver")), item: orNull(cell("Item Desc")), brand: orNull(cell("BRAND")), manager: orNull(cell("Manager")), supervisor: orNull(cell("Supervisors")), qtyRv: figure("Qty (RV)"), qtyDo: figure("Qty (DO)"), valueRv: figure("Invoice Amount(RV)"), valueDo: figure("Invoice Amount(DO)") });
      } catch (e) { issues.push({ sheet: t.sheet, row: i, reason: (e as Error).message, loaded: false }); }
    });
  }

  const consignmentSheet = sheetWith(wb, ["CS No", "BILL_QTY", "RECVD_QTY"]);
  if (consignmentSheet) {
    const t = findTable(wb, consignmentSheet, "CS No", ["CS Recvd Date.", "Supplier", "INVOICE_DATE", "Order No.", "Invoice No.", "Store Loc", "Item Code.", "Item Description.", "Expiry Date", "EXCISE_TAX_Y_N", "BILL_QTY", "RECVD_QTY"])!;
    eachRow(t, (cell, row, i) => {
      const consignmentNo = cell("CS No");
      if (!consignmentNo) return;
      const where = `${t.sheet}, row ${i}`;
      try {
        const receivedDate = cellDate(row.getCell(t.column("CS Recvd Date.")).value, where), itemCode = cell("Item Code.");
        if (!receivedDate || !itemCode) throw new Error(`${where}: no received date or item.`);
        const date = (h: string) => cellDate(row.getCell(t.column(h)).value, `${where}, ${h}`), quantity = (h: string) => num(row.getCell(t.column(h)).value, `${where}, ${h}`) ?? 0;
        consignments.push({ receivedDate, lineNo: i, consignmentNo, orderNo: orNull(cell("Order No.")), invoiceNo: orNull(cell("Invoice No.")), invoiceDate: date("INVOICE_DATE"), supplier: orNull(cell("Supplier")), location: orNull(cell("Store Loc")), itemCode, item: orNull(cell("Item Description.")), expiryDate: date("Expiry Date"), excise: orNull(cell("EXCISE_TAX_Y_N")), billedQty: quantity("BILL_QTY"), receivedQty: quantity("RECVD_QTY") });
      } catch (e) { issues.push({ sheet: t.sheet, row: i, reason: (e as Error).message, loaded: false }); }
    });
  }

  const expirySheet = sheetWith(wb, ["ITEM CODE", "Total cost", "Expiry Date"]);
  if (expirySheet) {
    const t = findTable(wb, expirySheet, "ITEM CODE", ["DESCRIPTION", "SIZE", "PACKING", "BRAND", "LOCATION2", "CTN", "OTR", "PCS", "Total cost", "Expiry Date", "REMARKS"])!;
    const cost = t.column("Total cost");
    // Above the headings the report prints its title (which department), its date, and the total cost.
    t.ws.eachRow({ includeEmpty: false }, (row, i) => {
      if (i >= t.head) return;
      row.eachCell((c) => {
        const title = text(c.value).toUpperCase();
        if (title.includes("AGEIN")) expiryReport ??= title.split(/\s*-\s*AGE/)[0].trim() || null;
        const v = typeof c.value === "object" && c.value && "result" in c.value ? c.value.result : c.value;
        if (v instanceof Date) expiryDate ??= formatDateCell(v) || null;
      });
      const total = row.getCell(cost).value, printed = typeof total === "object" && total && "result" in total ? total.result : total; // the merged title also reads as this cell, so only a number counts
      if (typeof printed === "number") controlTotal = roundMoney(printed);
    });
    if (!expiryDate || !expiryReport) throw new Error(`${t.sheet}: no report title or date above the headings.`);
    const categoryColumn = t.column("CATEGORY");
    eachRow(t, (cell, row, i) => {
      const itemCode = cell("ITEM CODE");
      if (!itemCode) return;
      const where = `${t.sheet}, row ${i}`;
      try {
        const expiryOn = cellDate(row.getCell(t.column("Expiry Date")).value, where), quantity = (h: string) => num(row.getCell(t.column(h)).value, `${where}, ${h}`), totalCost = quantity("Total cost");
        if (!expiryOn || totalCost === null) throw new Error(`${where}: no expiry date or cost.`);
        expiry.push({ lineNo: i, itemCode, item: orNull(cell("DESCRIPTION")), size: orNull(cell("SIZE")), packing: orNull(cell("PACKING")), brand: orNull(cell("BRAND")), category: categoryColumn ? orNull(text(row.getCell(categoryColumn).value)) : null, location: orNull(cell("LOCATION2")), cartons: quantity("CTN"), outers: quantity("OTR"), pieces: quantity("PCS"), totalCost, expiryDate: expiryOn, remarks: orNull(cell("REMARKS")) });
      } catch (e) { issues.push({ sheet: t.sheet, row: i, reason: (e as Error).message, loaded: false }); }
    });
    const sum = sumMoney(expiry.map((r) => r.totalCost));
    if (controlTotal !== null && Math.abs(sum - controlTotal) > 1) issues.push({ sheet: t.sheet, row: t.head, reason: `The costs add up to ${sum} but the sheet's total says ${controlTotal}.`, loaded: true });
  }

  return { variances, consignments, expiry, expiryDate: expiryDate as string | null, expiryReport: expiryReport as string | null, controlTotal: controlTotal as number | null, issues, rowsRead: variances.length + consignments.length + expiry.length };
}

export type Control = ReturnType<typeof controlFromWorkbook>;
