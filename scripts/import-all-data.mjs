// Loads the files from the OneDrive export folder into the database: supplier ageing, brand budgets (2027 yearly plan, 2026 monthly plan),
// logistics profitability (3 files) and the Dukan / Top Perfumes POS reports. It uses the app's own readers and save functions, so the result is exactly what the admin uploads would give.
// Default is a DRY RUN: everything runs inside one transaction that is ROLLED BACK at the end, so nothing is kept. Add --write to commit.
//   node --env-file=.env.local scripts/import-all-data.mjs [--write] [--migrate] [--ageing-date YYYY-MM-DD] [--only supplier,budget,profit,pos] [--root <folder>]
// --migrate      applies every pending migration up to 045 first (any pending migration of another developer included). Without it the script stops if the new tables are missing.
// --ageing-date  the supplier ageing report's date. It is not guessed: without it the supplier ageing is skipped.
// Connection settings (PGHOST, PGDATABASE, ...) come from the environment, so .env.local decides which database this touches. The host and database are printed first.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire, register } from "node:module";

register("./import-alias-loader.mjs", import.meta.url);
const require = createRequire(import.meta.url);
const { Client } = require("pg");
const XLSX = require("xlsx");

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? null : process.argv[i + 1] ?? true; };
const write = process.argv.includes("--write"), migrateFirst = process.argv.includes("--migrate");
const root = arg("root") || "D:/Projects/Sheikh/OneDrive_2026-11-27", ageingDate = arg("ageing-date");
const only = new Set(String(arg("only") || "supplier,budget,profit,pos").split(","));
if (ageingDate && !/^\d{4}-\d{2}-\d{2}$/.test(ageingDate)) { console.error("--ageing-date must look like 2026-11-26"); process.exit(1); }

const lib = (name) => import(`../lib/${name}.ts`);
const [{ readWorkbook, sheetsFromWorkbook }, { parseSupplierAgeing }, { saveSupplierAgeing }, { parseBrandYearPlan, parseBrandMonthPlan }, { saveBrandYearPlan, saveBrandMonthPlan },
  { parseProfitability, PROFITABILITY_LINES }, { saveProfitability }, { posGridFromFile }, { parsePosReport }, { savePosReport }, { migrate }] = await Promise.all(
  ["company-template", "supplier-ageing", "supplier-ageing-records", "brand-budget", "brand-budget-records", "profitability", "profitability-records", "pos-file", "pos-reports", "pos-reports-records", "schema"].map(lib));

const client = new Client({ connectionTimeoutMillis: 20000 });
await client.connect();
globalThis.__importClient = client;
const where = (await client.query("SELECT current_database() AS db, inet_server_addr()::text AS host")).rows[0];
console.log(`${write ? "WRITE" : "DRY RUN (rolled back)"} -> database ${where.db} on ${process.env.PGHOST ?? where.host}`);

const read = (path) => readFileSync(join(root, path));
const fail = (what, errors) => { throw new Error(`${what}: ${errors.slice(0, 5).join(" ")}`); };
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(xls|csv)$/i.test(n) ? [p] : []; });

try {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = 0");
  await client.query("SELECT pg_advisory_xact_lock(7451)"); // the same lock the app uses for migrations
  if (migrateFirst) {
    const applied = [];
    await migrate({ query: async (text, params) => { const r = await client.query(text, params); if (/^INSERT INTO app\.schema_migrations/.test(text)) applied.push(params[0]); return r; } }, "045_pos_reports");
    console.log(applied.length ? `migrations applied: ${applied.join(", ")}` : "migrations: nothing pending up to 045");
  }
  const need = ["supplier_ageing", "logistics_profitability", "brand_plan_years", "brand_plan_months", "pos_daily_sales", "pos_item_sales", "pos_purchases", "pos_stock"];
  const have = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' AND table_name = ANY($1)", [need])).rows.map((r) => r.table_name);
  const missing = need.filter((t) => !have.includes(t));
  if (missing.length) throw new Error(`These tables do not exist yet: ${missing.join(", ")}. Run again with --migrate.`);

  if (only.has("supplier")) {
    if (!ageingDate) console.log("supplier ageing: SKIPPED (pass --ageing-date YYYY-MM-DD)");
    else {
      // The 7 MB workbook is over the app's upload safety limit, so it is read with SheetJS here (a script you run, not an upload).
      const wb = XLSX.read(read("Rashid Nov 26/Supplier Ageing Report .xlsx"), { type: "buffer", dense: true });
      const { rows, errors } = parseSupplierAgeing(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }));
      if (errors.length) fail("supplier ageing", errors);
      console.log(`supplier ageing: ${await saveSupplierAgeing(ageingDate, rows)} accounts as of ${ageingDate}`);
    }
  }

  if (only.has("budget")) {
    const sheets = async (file) => sheetsFromWorkbook(await readWorkbook(read(file)));
    const yearSheet = (await sheets("Mahmoud Fin Manager 26-11/2027_Budget_preparation_with_brand_sheets V5 Trading and Distribution.xlsx")).find((s) => /brand index$/i.test(s.name.trim()));
    const monthSheet = (await sheets("Mahmoud Fin Manager 26-11/1. Sales Budget 26-11-2025 Budget Sales Trading and Distribution for 2026.xlsx")).find((s) => s.name.trim() === "2026");
    if (!yearSheet || !monthSheet) throw new Error("Budget sheets not found.");
    const year = parseBrandYearPlan(yearSheet.grid, 2027), month = parseBrandMonthPlan(monthSheet.grid);
    if (year.errors.length) fail("brand year plan", year.errors);
    if (month.errors.length) fail("brand month plan", month.errors);
    console.log(`brand budget: ${await saveBrandYearPlan(2027, year.rows)} brand rows for 2027, ${await saveBrandMonthPlan(2026, month.rows)} monthly rows for 2026`);
  }

  if (only.has("profit")) {
    const folder = "QE 26-11 as on OCt2026/";
    const files = [[`${folder}PROF REPOT OCT - 2026.xlsx`, PROFITABILITY_LINES[0]], [`${folder}Transind Profitability Report OCT - 2026.xlsx`, PROFITABILITY_LINES[1]], [`${folder}TL Profitability Report -2026.xlsx`, PROFITABILITY_LINES[2]]];
    for (const [file, line] of files) {
      const { rows, errors } = parseProfitability(sheetsFromWorkbook(await readWorkbook(read(file))), line);
      if (errors.length) fail(file, errors);
      console.log(`profitability: ${await saveProfitability(2026, rows)} months for ${line}${rows.some((r) => r.line !== line) ? " (and Kuwait)" : ""}`);
    }
  }

  if (only.has("pos")) {
    const files = [...walk(join(root, "Dukan")), ...walk(join(root, "Top Perfume"))];
    let saved = 0, rows = 0; const seen = new Set();
    for (const file of files) {
      const report = parsePosReport(posGridFromFile(readFileSync(file)));
      if (report.errors.length) fail(file, report.errors);
      const key = `${report.entity}|${report.kind}|${report.period}`;
      if (seen.has(key)) throw new Error(`Two files for ${key}: ${file}`); // the second would silently replace the first
      seen.add(key); rows += await savePosReport(report); saved++;
      if (saved % 25 === 0) console.log(`pos: ${saved} of ${files.length} files, ${rows} rows`);
    }
    console.log(`pos: ${saved} files, ${rows} rows`);
  }

  console.log("rows now in the tables:");
  for (const t of need) console.log(`  ${t}: ${(await client.query(`SELECT count(*)::int AS n FROM app.${t}`)).rows[0].n}`);
  await client.query(write ? "COMMIT" : "ROLLBACK");
  console.log(write ? "COMMITTED." : "Rolled back: nothing was kept. Run again with --write to keep it.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`FAILED, rolled back, nothing was kept: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
