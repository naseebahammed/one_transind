// Loads the monthly ERP P&L (the CSV made by preview-erp-pnl.ps1) into app.company_figures, section 'pnl'.
// Default is a DRY RUN: it only reads the database and prints what it would do. Nothing is written without --write.
//   node --env-file=.env.local scripts/import-erp-pnl.mjs --csv <erp-pnl-lines.csv> [--map data/erp-pnl-company-map.json] [--write] [--replace]
// --replace lets the ERP figures overwrite months a company already has on file; without it those company-months are skipped.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? null : process.argv[i + 1] ?? true; };
const csvPath = arg("csv"), mapPath = arg("map") || "data/erp-pnl-company-map.json", write = process.argv.includes("--write"), replace = process.argv.includes("--replace");
if (!csvPath) { console.error("Pass --csv <erp-pnl-lines.csv>"); process.exit(1); }

const raw = readFileSync(csvPath);
const sha256 = createHash("sha256").update(raw).digest("hex");

/** Minimal CSV reader: quoted fields, doubled quotes, commas and line breaks inside quotes. */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  head[0] = head[0].replace(/^﻿/, "");
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const companyIds = JSON.parse(readFileSync(mapPath, "utf8"));
const all = parseCsv(raw.toString("utf8"));
const skippedCompanies = new Map();
const lines = [];
let decemberSkipped = 0;
for (const r of all) {
  const id = companyIds[r.Company];
  if (!id) { skippedCompanies.set(r.Company, (skippedCompanies.get(r.Company) ?? 0) + 1); continue; }
  if (r.Parent.startsWith("0000") || r.Actual === "") continue; // 0000 = balance carried forward, not a month's figure
  // A December sheet includes the year-end closing entries (revenue shows as minus the year's sales), so it is not December's activity.
  if (r.Month === "12" && !process.argv.includes("--include-december")) { decemberSkipped++; continue; }
  lines.push({ companyId: id, company: r.Company, period: `${r.Year}-${String(r.Month).padStart(2, "0")}-01`, main: r.Parent, line: r.Account, value: Number(r.Actual) });
}
skippedCompanies.delete("Total"); // the sheet's own group total: loading it would double every figure
const isRevenue = (main) => /^(6000|6100)\b/.test(main);

const db = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false });
await db.connect();
if (!write) await db.query("SET default_transaction_read_only = on"); // a dry run cannot write even by mistake
try {
  // This script never runs the app's migrations. It needs the tables as they are.
  const have = new Set((await db.query("SELECT main || '|' || sub AS k FROM app.accounts WHERE section='pnl'")).rows.map((r) => r.k));
  const newAccounts = [...new Map(lines.filter((l) => !have.has(`${l.main}|${l.line}`)).map((l) => [`${l.main}|${l.line}`, l])).values()];
  const existing = new Map();
  for (const r of (await db.query("SELECT company_id, period::text AS period, count(*)::int AS n FROM app.company_figures WHERE section='pnl' AND company_id = ANY($1::int[]) GROUP BY 1,2", [Object.values(companyIds)])).rows) existing.set(`${r.company_id}|${r.period}`, r.n);
  const clash = (l) => existing.has(`${l.companyId}|${l.period}`);
  const toLoad = replace ? lines : lines.filter((l) => !clash(l));
  const clashing = [...new Set(lines.filter(clash).map((l) => `${l.company} ${l.period.slice(0, 7)}`))];

  console.log(`ERP lines read: ${all.length}. Mapped and non-zero-period lines: ${lines.length}. Would load: ${toLoad.length}.`);
  console.log(`December lines skipped (year-end closing entries; pass --include-december for a December export without them): ${decemberSkipped}`);
  console.log("Companies not mapped (skipped):", [...skippedCompanies].map(([k, n]) => `${k} (${n})`).join(", ") || "none");
  console.log(`New accounts to add to the chart: ${newAccounts.length} (of ${new Set(lines.map((l) => `${l.main}|${l.line}`)).size} used)`);
  console.log(`Months where the company already has P&L figures on file: ${clashing.length}${replace ? " (will be REPLACED)" : " (skipped; pass --replace to overwrite)"}`);
  if (clashing.length) console.log("  ", clashing.slice(0, 40).join("; ") + (clashing.length > 40 ? " ..." : ""));
  const perCompany = new Map();
  for (const l of toLoad) { const p = perCompany.get(l.company) ?? { months: new Set(), rows: 0 }; p.months.add(l.period); p.rows++; perCompany.set(l.company, p); }
  console.table([...perCompany].map(([company, p]) => ({ company, months: p.months.size, rows: p.rows })));

  if (!write) { console.log("Dry run only. Nothing was written."); process.exit(0); }

  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(7451)");
  for (const a of newAccounts)
    await db.query("INSERT INTO app.accounts(section,main,sub,main_order,kind,normal_sign) VALUES('pnl',$1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [a.main, a.line, Number.parseInt(a.main, 10), isRevenue(a.main) ? "revenue" : "expense", isRevenue(a.main) ? 1 : -1]);
  await db.query("INSERT INTO app.import_files(sha256,file) VALUES($1,$2) ON CONFLICT (sha256) DO NOTHING", [sha256, raw]);
  const importIds = [];
  for (const id of new Set(toLoad.map((l) => l.companyId))) {
    const mine = toLoad.filter((l) => l.companyId === id), periods = [...new Set(mine.map((l) => l.period))].sort();
    const { rows: [imp] } = await db.query("INSERT INTO app.imports(company_id,section,source,file_name,file_type,file_size,sha256,status,rows_loaded,period_from,period_to,rows_read,uploaded_by) VALUES($1,'pnl','erp',$2,'csv',$3,$4,'loaded',$5,$6,$7,$5,'erp-pnl-import') RETURNING id",
      [id, "ERP monthly P&L 2024-2026", raw.length, sha256, mine.length, periods[0], periods.at(-1)]);
    importIds.push(imp.id);
    if (replace) await db.query("DELETE FROM app.company_figures WHERE company_id=$1 AND section='pnl' AND period = ANY($2::date[])", [id, periods]);
    await db.query(`INSERT INTO app.company_figures(company_id,section,period,main,line,value,import_id)
      SELECT $1,'pnl',p,m,l,v,$6 FROM unnest($2::date[],$3::text[],$4::text[],$5::numeric[]) AS t(p,m,l,v)
      ON CONFLICT ON CONSTRAINT company_figures_key DO UPDATE SET value=EXCLUDED.value,import_id=EXCLUDED.import_id,updated=now()`,
      [id, ...[mine.map((l) => l.period), mine.map((l) => l.main), mine.map((l) => l.line), mine.map((l) => l.value)], imp.id]);
  }
  // Self-check: what is now stored must add up to what the file said, or nothing is kept.
  const stored = Number((await db.query("SELECT COALESCE(sum(value),0)::float8 AS total, count(*)::int AS n FROM app.company_figures WHERE import_id = ANY($1::int[])", [importIds])).rows[0].total);
  const expected = toLoad.reduce((total, l) => total + l.value, 0);
  if (Math.abs(stored - expected) > 0.5) throw new Error(`Self-check failed: stored ${stored.toFixed(2)} but the file adds to ${expected.toFixed(2)}. Rolled back.`);
  await db.query("COMMIT");
  console.log(`Self-check passed (${stored.toFixed(2)} QAR net across all loaded lines).`);
  console.log("Written. The reports cache refreshes within an hour, or restart the app to see it now.");
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await db.end();
}
