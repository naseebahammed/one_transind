// App-owned tables live in their own schema so they never collide with the read-only business tables in public.
// Ordered migrations: each runs once, recorded in app.schema_migrations. Never edit one that has shipped; add a new one.
const BASELINE = `
CREATE TABLE IF NOT EXISTS app.deals(seq SERIAL, id TEXT PRIMARY KEY, sector TEXT NOT NULL, acc_ar TEXT NOT NULL, acc_en TEXT NOT NULL,
  cust TEXT, value INTEGER NOT NULL, stage INTEGER NOT NULL, owner INTEGER NOT NULL, close TEXT NOT NULL, so TEXT);
CREATE TABLE IF NOT EXISTS app.invoices(number TEXT PRIMARY KEY, "customerId" TEXT NOT NULL, date TEXT, "dueDate" TEXT,
  amount INTEGER, balance INTEGER, bucket TEXT);
CREATE TABLE IF NOT EXISTS app.companies(id SERIAL PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1);
ALTER TABLE app.companies DROP COLUMN IF EXISTS email;
ALTER TABLE app.companies DROP COLUMN IF EXISTS phone;
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS room_types JSONB NOT NULL DEFAULT '[]';
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS total_rooms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS property_type TEXT NOT NULL DEFAULT '';
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS logo BYTEA;
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS logo_type TEXT;
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS erp_code TEXT NOT NULL DEFAULT '';
ALTER TABLE app.companies DROP COLUMN IF EXISTS data_owner;
CREATE TABLE IF NOT EXISTS app.company_files(id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, data BYTEA NOT NULL, created TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE app.company_files ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
CREATE UNIQUE INDEX IF NOT EXISTS companies_name ON app.companies(lower(name));
CREATE TABLE IF NOT EXISTS app.sectors(key TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app.property_types(key TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app.sales_departments(code TEXT PRIMARY KEY, label TEXT, hidden INTEGER NOT NULL DEFAULT 0);
ALTER TABLE app.sales_departments ADD COLUMN IF NOT EXISTS sector TEXT;
CREATE TABLE IF NOT EXISTS app.accounts(id SERIAL PRIMARY KEY, main TEXT NOT NULL, sub TEXT NOT NULL, main_order INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_main_sub ON app.accounts(lower(main), lower(sub));
CREATE TABLE IF NOT EXISTS app.company_figures(company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  section TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK (month BETWEEN 0 AND 11), line TEXT NOT NULL,
  value NUMERIC(18,2) NOT NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(company_id, section, year, month, line));
CREATE TABLE IF NOT EXISTS app.report_files(name TEXT PRIMARY KEY, body TEXT NOT NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app.log(id SERIAL PRIMARY KEY, t TEXT, job TEXT, ok INTEGER, n INTEGER);
`;

// Every number gets a row, a company and a checked line. Revenue is positive, costs negative, amounts in QAR.
const STANDARD_DATA = `
-- One chart of lines for every section; section 'pnl' is what the Chart of accounts page manages.
ALTER TABLE app.accounts ADD COLUMN section TEXT NOT NULL DEFAULT 'pnl';
DROP INDEX app.accounts_main_sub;
CREATE UNIQUE INDEX accounts_section_main_sub ON app.accounts(section, lower(main), lower(sub));
ALTER TABLE app.accounts ADD CONSTRAINT accounts_section_key UNIQUE(section, main, sub);
INSERT INTO app.accounts(section, main, sub) VALUES
  ('balance','ASSETS','Cash at bank'),
  ('balance','ASSETS','Receivables: current'), ('balance','ASSETS','Receivables: 1-30 days'), ('balance','ASSETS','Receivables: 31-60 days'), ('balance','ASSETS','Receivables: 61-90 days'), ('balance','ASSETS','Receivables: over 90 days'),
  ('balance','ASSETS','Stock'), ('balance','ASSETS','Fixed assets'), ('balance','ASSETS','Other assets'),
  ('balance','FUNDING','Payables: current'), ('balance','FUNDING','Payables: 1-30 days'), ('balance','FUNDING','Payables: 31-60 days'), ('balance','FUNDING','Payables: 61-90 days'), ('balance','FUNDING','Payables: over 90 days'),
  ('balance','FUNDING','Loan balance'), ('balance','FUNDING','Other liabilities'), ('balance','FUNDING','Equity'),
  ('balance','MEMO','Loan repayments due in 12 months'),
  ('budget','BUDGET','Revenue'), ('budget','BUDGET','Direct cost'), ('budget','BUDGET','Overheads'),
  ('people','PEOPLE','Headcount'), ('people','PEOPLE','Payroll cost'), ('people','PEOPLE','Joiners'), ('people','PEOPLE','Leavers'),
  ('sales','REVENUE','Sales'),
  ('units','UNITS','Available'), ('units','UNITS','Long stay'), ('units','UNITS','Short stay'), ('units','UNITS','Room revenue');

-- One row per upload attempt, with the original file. app.company_files was never used.
DROP TABLE app.company_files;
CREATE TABLE app.imports(id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('pnl','sales','units','daily','balance','budget','people')),
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','legacy','erp')),
  file_name TEXT NOT NULL, file_type TEXT NOT NULL DEFAULT '', file_size INTEGER NOT NULL DEFAULT 0, sha256 TEXT NOT NULL DEFAULT '', file BYTEA,
  status TEXT NOT NULL CHECK (status IN ('loaded','rejected')), error TEXT, rows_loaded INTEGER NOT NULL DEFAULT 0,
  period_from DATE, period_to DATE, uploaded_by TEXT, created TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX imports_company ON app.imports(company_id, created DESC);

-- Every monthly number. No row = not submitted; 0 = a real zero. import_id NULL = typed by hand.
ALTER TABLE app.company_figures RENAME TO company_figures_old;
ALTER TABLE app.company_figures_old DROP CONSTRAINT company_figures_pkey;
CREATE TABLE app.company_figures(company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('pnl','sales','units','balance','budget','people')),
  period DATE NOT NULL CHECK (EXTRACT(day FROM period) = 1),
  main TEXT NOT NULL, line TEXT NOT NULL, unit_type TEXT NOT NULL DEFAULT '',
  value NUMERIC(18,2) NOT NULL, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id, section, period, main, line, unit_type),
  FOREIGN KEY(section, main, line) REFERENCES app.accounts(section, main, sub) ON UPDATE CASCADE);
INSERT INTO app.company_figures(company_id, section, period, main, line, value, updated)
  SELECT o.company_id, o.section, make_date(o.year, o.month + 1, 1), a.main, o.line, o.value, o.updated
  FROM app.company_figures_old o JOIN app.accounts a ON a.section = o.section AND a.sub = o.line;
DROP TABLE app.company_figures_old;

-- The daily stay report, typed. Average rate and occupancy are calculated, never stored. No rooms-available figure (0) cannot break the check.
CREATE TABLE app.daily_sales(company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE, date DATE NOT NULL,
  long_guests NUMERIC(18,2) NOT NULL DEFAULT 0, long_rate NUMERIC(18,2) NOT NULL DEFAULT 0, long_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  short_guests NUMERIC(18,2) NOT NULL DEFAULT 0, short_rate NUMERIC(18,2) NOT NULL DEFAULT 0, short_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  rooms_occupied NUMERIC(18,2) NOT NULL DEFAULT 0, room_revenue NUMERIC(18,2) NOT NULL DEFAULT 0, other_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  rooms_available NUMERIC(18,2) NOT NULL DEFAULT 0, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id, date),
  CONSTRAINT daily_sales_rooms CHECK (rooms_available = 0 OR rooms_occupied <= rooms_available) NOT VALID);

-- Monthly hotel sales always come from the daily rows, so the two cannot drift apart.
CREATE VIEW app.daily_sales_monthly AS
  SELECT d.company_id, date_trunc('month', d.date)::date AS period, v.main, v.line, SUM(v.value) AS value
  FROM app.daily_sales d CROSS JOIN LATERAL (VALUES
    ('GUESTS','Long stay',d.long_guests), ('GUESTS','Short stay',d.short_guests),
    ('REVENUE','Room revenue',d.room_revenue), ('REVENUE','Other revenue',d.other_revenue),
    ('ROOMS','Occupied',d.rooms_occupied), ('ROOMS','Available',d.rooms_available)) v(main, line, value)
  GROUP BY 1, 2, 3, 4;

ALTER TABLE app.companies ADD CONSTRAINT companies_sector_fk FOREIGN KEY(sector) REFERENCES app.sectors(key) ON UPDATE CASCADE;
ALTER TABLE app.log ADD COLUMN at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE app.log DROP COLUMN t;
`;

// The CSV text now lives in app.imports. Dividing by zero stops this migration on any database where a file was not moved yet: run scripts/migrate-report-files.ts there first.
const DROP_REPORT_FILES = `
SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM app.report_files r WHERE NOT EXISTS (
  SELECT 1 FROM app.imports i WHERE i.source = 'legacy' AND i.file_name = r.name AND i.file = convert_to(r.body, 'UTF8'))) THEN 0 ELSE 1 END);
DROP TABLE app.report_files;
`;

// A company-level expenses section on the company page, like budget/people: one monthly total, entered through the same figure grid.
const COMPANY_EXPENSES = `
ALTER TABLE app.imports DROP CONSTRAINT imports_section_check;
ALTER TABLE app.imports ADD CONSTRAINT imports_section_check CHECK (section IN ('pnl','sales','units','daily','balance','budget','people','expenses'));
ALTER TABLE app.company_figures DROP CONSTRAINT company_figures_section_check;
ALTER TABLE app.company_figures ADD CONSTRAINT company_figures_section_check CHECK (section IN ('pnl','sales','units','balance','budget','people','expenses'));
INSERT INTO app.accounts(section, main, sub) VALUES ('expenses','EXPENSES','Expenses');
`;

export const MIGRATIONS: readonly (readonly [string, string])[] = [["001_baseline", BASELINE], ["002_standard_data", STANDARD_DATA], ["003_drop_report_files", DROP_REPORT_FILES], ["005_company_expenses", COMPANY_EXPENSES]];

/** Applies the migrations not yet recorded, optionally only up to and including one. Run it inside a transaction holding the init lock. */
export async function migrate(c: { query: (text: string, params?: unknown[]) => Promise<{ rows: { id: string }[] }> }, upTo?: string) {
  await c.query("CREATE SCHEMA IF NOT EXISTS app");
  await c.query("CREATE TABLE IF NOT EXISTS app.schema_migrations(id TEXT PRIMARY KEY, applied TIMESTAMPTZ NOT NULL DEFAULT now())");
  const done = new Set((await c.query("SELECT id FROM app.schema_migrations")).rows.map((r) => r.id));
  for (const [id, sql] of MIGRATIONS) {
    if (!done.has(id)) {
      await c.query(sql);
      await c.query("INSERT INTO app.schema_migrations(id) VALUES($1)", [id]);
    }
    if (id === upTo) break;
  }
}
