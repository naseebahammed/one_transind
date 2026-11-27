// Turns a monthly "VARIANCE REPORT" workbook (Data sheet: invoice vs delivery-order qty and value) into data/variance-report.json.
// Usage: node scripts/import-variance-report.mjs "<file.xlsx>" "November 2026"
import XLSX from "xlsx";
import * as fs from "node:fs";
import { writeFileSync } from "node:fs";
XLSX.set_fs(fs); // the ESM build of xlsx needs the file system handed to it

const [file, month] = process.argv.slice(2);
if (!file || !month) throw new Error('Usage: node scripts/import-variance-report.mjs "<file.xlsx>" "November 2026"');
const lines = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets["Data"]);
if (!lines.length) throw new Error("The Data sheet is empty or missing.");

const group = (key) => {
  const map = new Map();
  for (const line of lines) {
    const name = String(line[key] ?? "").trim() || "Unassigned";
    const row = map.get(name) ?? { name, invoiced: 0, delivered: 0, variance: 0, lines: 0 };
    row.invoiced += line["Invoice Amount(RV)"] ?? 0;
    row.delivered += line["Invoice Amount(DO)"] ?? 0;
    row.variance += line["Value Variance"] ?? 0;
    row.lines += 1;
    map.set(name, row);
  }
  return [...map.values()].map((r) => ({ ...r, invoiced: Math.round(r.invoiced * 100) / 100, delivered: Math.round(r.delivered * 100) / 100, variance: Math.round(r.variance * 100) / 100 })).sort((a, b) => b.variance - a.variance);
};

const report = { month, byBrand: group("BRAND"), bySupervisor: group("Supervisors"), byCustomer: group("Customer").slice(0, 20) };
writeFileSync(new URL("../data/variance-report.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(`${lines.length} lines, ${report.byBrand.length} brands, ${report.bySupervisor.length} supervisors`);
