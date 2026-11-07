// One-shot: moves the CSV text in app.report_files into company_figures and daily_sales. Each file is moved once, so rerunning adds nothing.
// Done on the main database. Only needed on another database that still has report_files; delete this script once none does.
// Dry run (changes nothing): node --env-file=.env.local scripts/migrate-report-files.ts --dry-run
// For real:                  node --env-file=.env.local scripts/migrate-report-files.ts
import { createHash } from "node:crypto";
import pg from "pg";
import { migrate } from "../lib/schema.ts";

const dry = process.argv.includes("--dry-run");
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const fold = (s: string) => clean(s).toLowerCase();
const close = (a: number, b: number, cells: number) => Math.abs(a - b) <= 0.005 * cells + 0.01; // each cell may round by half a dirham at most
const DAILY_COLS = ["long_guests", "long_rate", "long_total", "short_guests", "short_rate", "short_total", "rooms_occupied", "room_revenue", "other_revenue"] as const;
// CSV columns: date, the nine above, avg_rate (10, calculated), rooms_available (11), occ (12, calculated).
const GRID_FROM_DAILY: Record<string, number> = { "GUESTS|Long stay": 1, "GUESTS|Short stay": 4, "REVENUE|Room revenue": 8, "REVENUE|Other revenue": 9, "ROOMS|Occupied": 7, "ROOMS|Available": 11 };
// Approved 2026-11-05: P&L lines not in the chart, added under their current group.
const NEW_ACCOUNTS: [string, string][] = [
  ["REVENUE", "Sales"], ["REVENUE", "SPA Income"], ["REVENUE", "Supermarket Rental Income"], ["REVENUE", "Space Rental income - Super Market"], ["REVENUE", "Barber Shop"],
  ["REVENUE", "Space Rental income - Baskin Robin"], ["REVENUE", "Space Rental income - Restaurant"], ["REVENUE", "Mis Income/Brekage"], ["REVENUE", "Penalty and Contract Cancellation"],
  ["COGS", "Cost of Goods Sold"], ["COGS", "Cost Aminties"], ["LEGAL AND PROFESSIONAL EXP", "Legal & Fine Expenses"], ["LEGAL AND PROFESSIONAL EXP", "Govt Fee"], ["REPAIR AND MAINTENANCE EXP", "Amc - Swimming Pool Maintenance"],
];

const c = new pg.Client({ host: process.env.PGHOST?.trim(), port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false });
await c.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(7451)");
  if (!(await c.query<{ t: string | null }>("SELECT to_regclass('app.report_files') AS t")).rows[0].t) throw new Error("app.report_files is already gone: nothing to move.");
  await migrate(c, "002_standard_data"); // later migrations drop report_files

  for (const [main, sub] of NEW_ACCOUNTS)
    await c.query("INSERT INTO app.accounts(section,main,sub,main_order) VALUES('pnl',$1,$2,(SELECT COALESCE(MAX(main_order),0) FROM app.accounts WHERE section='pnl' AND main=$1)) ON CONFLICT DO NOTHING", [main, sub]);
  const chart = new Map((await c.query<{ section: string; main: string; sub: string }>("SELECT section,main,sub FROM app.accounts")).rows.map((a) => [`${a.section}|${fold(a.main)}|${fold(a.sub)}`, a]));

  const companies = (await c.query<{ id: number; name: string }>("SELECT id,name FROM app.companies")).rows;
  const alManzil = companies.find((x) => fold(x.name).startsWith("al manzil"))?.id;
  const company = (name: string) => {
    const id = /^al-manzil/.test(name) ? alManzil : Number(name.match(/-(\d+)\.csv$/)?.[1]);
    if (!id || !companies.some((x) => x.id === id)) throw new Error(`${name}: no company found.`);
    return id;
  };
  const files = (await c.query<{ name: string; body: string }>("SELECT name,body FROM app.report_files ORDER BY name")).rows;
  const moved = new Set((await c.query<{ file_name: string }>("SELECT file_name FROM app.imports WHERE source='legacy'")).rows.map((r) => r.file_name));
  const rowsOf = (body: string) => body.replace(/^﻿/, "").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
  const sectionOf = (n: string) => (/daily/.test(n) ? "daily" : /^units-/.test(n) ? "units" : /sales/.test(n) ? "sales" : "pnl");
  const dailyByCompany = new Map(files.filter((f) => sectionOf(f.name) === "daily").map((f) => [company(f.name), rowsOf(f.body)]));

  const record = async (f: { name: string; body: string }, id: number, section: string, rows: number, dates: string[]) => {
    const file = Buffer.from(f.body), sorted = [...dates].sort();
    const r = await c.query<{ id: number }>(`INSERT INTO app.imports(company_id,section,source,file_name,file_type,file_size,sha256,file,status,rows_loaded,period_from,period_to)
      VALUES($1,$2,'legacy',$3,'text/csv',$4,$5,$6,'loaded',$7,$8,$9) RETURNING id`, [id, section, f.name, file.length, createHash("sha256").update(file).digest("hex"), file, rows, sorted[0] ?? null, sorted.at(-1) ?? null]);
    return r.rows[0].id;
  };

  await c.query("ALTER TABLE app.daily_sales DROP CONSTRAINT IF EXISTS daily_sales_rooms"); // existing bad days must load so they can be listed and replaced
  const report: string[][] = [["file", "company", "year", "old total", "new total", "rows"]];
  const check = (name: string, id: number, year: string, oldSum: number, newSum: number, cells: number) => {
    report.push([name, String(id), year, oldSum.toFixed(2), newSum.toFixed(2), String(cells)]);
    if (!close(oldSum, newSum, cells)) throw new Error(`${name} ${year}: old total ${oldSum} does not match new total ${newSum}.`);
  };

  for (const f of files) {
    if (moved.has(f.name)) { console.log(`skip ${f.name}: already moved`); continue; }
    const id = company(f.name), section = sectionOf(f.name), rows = rowsOf(f.body);

    if (section === "daily") {
      const importId = await record(f, id, "daily", rows.length, rows.map((r) => r[0].slice(0, 7) + "-01"));
      for (const r of rows)
        await c.query(`INSERT INTO app.daily_sales(company_id,date,${DAILY_COLS.join(",")},rooms_available,import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [id, r[0], ...r.slice(1, 10), r[11], importId]);
      for (const y of new Set(rows.map((r) => r[0].slice(0, 4)))) {
        const these = rows.filter((r) => r[0].startsWith(y));
        const { rows: [n] } = await c.query<{ rev: number; n: number }>("SELECT SUM(room_revenue)::float8 AS rev, COUNT(*)::int AS n FROM app.daily_sales WHERE company_id=$1 AND date>=make_date($2::int,1,1) AND date<make_date($2::int+1,1,1)", [id, y]);
        if (n.n !== these.length) throw new Error(`${f.name} ${y}: ${these.length} days in the file, ${n.n} loaded.`);
        check(f.name, id, y, these.reduce((s, r) => s + +r[8], 0), n.rev, these.length);
      }
      continue;
    }

    // A hotel's stored sales grid is replaced by the view over daily_sales: keep the file, report anything the view would not reproduce.
    if (section === "sales" && dailyByCompany.has(id)) {
      await record(f, id, "sales", 0, []);
      const days = dailyByCompany.get(id)!;
      for (const r of rows) {
        const col = GRID_FROM_DAILY[`${r[1]}|${r[2]}`];
        if (col === undefined) { console.log(`GRID ONLY ${f.name}: ${r[0]} ${r[1]} | ${r[2]} = ${r.slice(3).join(" ")}`); continue; }
        r.slice(3).forEach((v, m) => {
          const prefix = `${r[0]}-${String(m + 1).padStart(2, "0")}`, derived = days.filter((d) => d[0].startsWith(prefix)).reduce((s, d) => s + +d[col], 0);
          if (Math.abs(derived - +v) > 0.01) console.log(`GRID DIFFERS ${f.name}: ${prefix} ${r[1]} | ${r[2]}: grid ${v}, daily ${derived.toFixed(2)}`);
        });
      }
      continue;
    }

    // Sum repeated lines (same account, different spacing). Zero cells are skipped: the CSV cannot tell a blank from a real zero.
    const cells = new Map<string, { year: string; period: string; main: string; line: string; unit: string; value: number }>();
    const oldTotals = new Map<string, number>();
    for (const [year, main, sub, ...m] of rows) {
      const a = section === "units" ? chart.get(`units|units|${fold(sub)}`) : chart.get(`${section}|${fold(main)}|${fold(sub)}`);
      const nonZero = m.some((v) => +v);
      if (!a) { if (nonZero) throw new Error(`${f.name}: "${main} | ${sub}" is not in the chart of accounts.`); continue; }
      m.forEach((v, i) => {
        if (!+v) return;
        const period = `${year}-${String(i + 1).padStart(2, "0")}-01`, unit = section === "units" ? clean(main) : "", k = `${period}|${a.main}|${a.sub}|${unit}`;
        const cell = cells.get(k) ?? { year, period, main: a.main, line: a.sub, unit, value: 0 };
        cell.value += +v;
        cells.set(k, cell);
        oldTotals.set(year, (oldTotals.get(year) ?? 0) + +v);
      });
    }
    const list = [...cells.values()];
    const importId = await record(f, id, section, list.length, list.map((x) => x.period));
    for (const x of list)
      await c.query("INSERT INTO app.company_figures(company_id,section,period,main,line,unit_type,value,import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [id, section, x.period, x.main, x.line, x.unit, x.value, importId]);
    for (const [y, oldSum] of oldTotals) {
      const { rows: [n] } = await c.query<{ v: number }>("SELECT SUM(value)::float8 AS v FROM app.company_figures WHERE company_id=$1 AND section=$2 AND period>=make_date($3::int,1,1) AND period<make_date($3::int+1,1,1)", [id, section, y]);
      check(f.name, id, y, oldSum, n.v, list.filter((x) => x.year === y).length);
    }
  }
  await c.query("ALTER TABLE app.daily_sales ADD CONSTRAINT daily_sales_rooms CHECK (rooms_available = 0 OR rooms_occupied <= rooms_available) NOT VALID");

  console.log(report.map((r) => r.join("\t")).join("\n"));
  const bad = (await c.query<{ company_id: number; n: number; a: string; b: string }>("SELECT company_id, COUNT(*)::int AS n, MIN(date)::text AS a, MAX(date)::text AS b FROM app.daily_sales WHERE rooms_available > 0 AND rooms_occupied > rooms_available GROUP BY 1")).rows;
  for (const b of bad) console.log(`BAD DAYS company ${b.company_id}: ${b.n} days with occupancy over 100% (${b.a} to ${b.b}). Replace them with a corrected upload.`);
  const tooMany = (await c.query<{ company_id: number; n: number; a: string; b: string; rooms: number }>("SELECT d.company_id, COUNT(*)::int AS n, MIN(d.date)::text AS a, MAX(d.date)::text AS b, MAX(co.total_rooms) AS rooms FROM app.daily_sales d JOIN app.companies co ON co.id=d.company_id WHERE co.total_rooms > 0 AND d.rooms_available > co.total_rooms GROUP BY 1")).rows;
  for (const b of tooMany) console.log(`BAD DAYS company ${b.company_id}: ${b.n} days with more rooms available than the property's ${b.rooms} (${b.a} to ${b.b}). Replace them with a corrected upload.`);
  for (const t of ["company_figures", "daily_sales", "imports"]) console.log(t, (await c.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM app.${t}`)).rows[0].n);
  await c.query(dry ? "ROLLBACK" : "COMMIT");
  console.log(dry ? "DRY RUN: rolled back, nothing changed." : "Committed.");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("Rolled back:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await c.end();
}
