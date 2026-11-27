// Reads a POS report file (.xls, or the .csv some months were saved as) into rows of cells. Uses the SheetJS reader, since ExcelJS cannot open the old .xls format.
// Checks the file before parsing it: size, the file's own signature (an old Excel file or plain text, not a renamed program or archive) and the sheet's dimensions.
import * as XLSX from "xlsx";
import { MAX_WORKBOOK_COLS, MAX_WORKBOOK_ROWS } from "./company-template.ts";

export const MAX_POS_FILE_BYTES = 7 * 1024 * 1024;
const OLD_EXCEL_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function posGridFromFile(buf: Buffer): unknown[][] {
  if (!buf.length || buf.length > MAX_POS_FILE_BYTES) throw new Error("The file is empty or over 7 MB.");
  const oldExcel = OLD_EXCEL_SIGNATURE.every((b, i) => buf[i] === b);
  const plainText = !buf.subarray(0, 4096).includes(0); // a text file has no zero bytes; zip files (.xlsx) and programs do
  if (!oldExcel && !plainText) throw new Error("Not an .xls or .csv report file.");
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: false, dense: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook has no sheet.");
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  if (grid.length > MAX_WORKBOOK_ROWS || grid.some((r) => r.length > MAX_WORKBOOK_COLS)) throw new Error("Spreadsheet dimensions exceed the maximum allowed rows or columns.");
  return grid;
}
