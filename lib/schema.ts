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

// A company can have branches (e.g. the 4 Mr. Shawarma restaurants). branch_id NULL = the whole company, so every existing row stays valid.
// The key uses COALESCE(branch_id, 0) because a NULL cannot be part of a primary key.
const COMPANY_BRANCHES = `
CREATE TABLE app.branches(id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX branches_company_name ON app.branches(company_id, lower(name));
ALTER TABLE app.company_figures ADD COLUMN branch_id INTEGER REFERENCES app.branches(id);
ALTER TABLE app.company_figures DROP CONSTRAINT company_figures_pkey;
CREATE UNIQUE INDEX company_figures_key ON app.company_figures(company_id, COALESCE(branch_id, 0), section, period, main, line, unit_type);
ALTER TABLE app.daily_sales ADD COLUMN branch_id INTEGER REFERENCES app.branches(id);
ALTER TABLE app.daily_sales DROP CONSTRAINT daily_sales_pkey;
CREATE UNIQUE INDEX daily_sales_key ON app.daily_sales(company_id, COALESCE(branch_id, 0), date);
`;

// Branches show on the company page only for companies that are marked as having them. Companies that already have branches stay marked.
const COMPANY_HAS_BRANCHES = `
ALTER TABLE app.companies ADD COLUMN has_branches INTEGER NOT NULL DEFAULT 0;
UPDATE app.companies SET has_branches = 1 WHERE id IN (SELECT company_id FROM app.branches);
`;

// Daily takings of a branch by payment channel (cash, card, delivery apps, bank deposit). One row per branch, day and line; gross sales are added up when read.
const DAILY_RECEIPTS = `
CREATE TABLE app.daily_receipts(company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE, branch_id INTEGER NOT NULL REFERENCES app.branches(id),
  date DATE NOT NULL, line TEXT NOT NULL, value NUMERIC(18,2) NOT NULL, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL,
  updated TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(branch_id, date, line));
ALTER TABLE app.imports DROP CONSTRAINT imports_section_check;
ALTER TABLE app.imports ADD CONSTRAINT imports_section_check CHECK (section IN ('pnl','sales','units','daily','balance','budget','people','expenses','receipts'));
`;

// The deals pipeline page is gone. Dividing by zero stops this migration on any database where app.deals still has rows, so nothing is lost silently.
const DROP_DEALS = `
SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM app.deals) THEN 0 ELSE 1 END);
DROP TABLE app.deals;
`;

// Nothing reads app.invoices any more. Same guard as DROP_DEALS: stops if the table still has rows.
const DROP_INVOICES = `
SELECT 1 / (CASE WHEN EXISTS (SELECT 1 FROM app.invoices) THEN 0 ELSE 1 END);
DROP TABLE app.invoices;
`;

// Enterprise foundation, additive only (nothing existing is changed or dropped): staging + reporting schemas, shared lookup tables,
// a calendar, import quality counters and the first plain-named views for Excel. The read-only login is NOT created here (see docs/report-reader-setup.sql).
const ENTERPRISE_FOUNDATION = `
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS rpt;

-- Days of the week and month for "days gone / days remaining" maths. Only Friday is off, as in the sales reports (November 2026 = 26 working days).
-- shortcut: public holidays count as working days, add a holiday list when the reports need it.
CREATE TABLE app.dim_calendar(date DATE PRIMARY KEY, year INTEGER NOT NULL, month INTEGER NOT NULL, day INTEGER NOT NULL,
  month_start DATE NOT NULL, iso_week INTEGER NOT NULL, day_name TEXT NOT NULL, is_working_day BOOLEAN NOT NULL);
INSERT INTO app.dim_calendar
  SELECT d::date, EXTRACT(year FROM d), EXTRACT(month FROM d), EXTRACT(day FROM d), date_trunc('month', d)::date,
    EXTRACT(week FROM d), trim(to_char(d, 'Day')), EXTRACT(isodow FROM d) <> 5
  FROM generate_series('2018-01-01'::date, '2040-12-31'::date, interval '1 day') d;

-- Shared lookups: one row per real thing, so "Rafeeq" and "RAFEEQ " stop being two lines.
CREATE TABLE app.payment_channels(id SERIAL PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('cash','card','delivery_app','bank','discount','other')));
CREATE UNIQUE INDEX payment_channels_name ON app.payment_channels(lower(name));
INSERT INTO app.payment_channels(name) SELECT DISTINCT trim(line) FROM app.daily_receipts WHERE trim(line) <> '' ON CONFLICT DO NOTHING;
CREATE TABLE app.locations(id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE app.departments(id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE app.brands(id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE app.channels(id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);

-- Did the file load completely? control_total is the total printed in the sheet, to compare with what was loaded.
ALTER TABLE app.imports ADD COLUMN rows_read INTEGER, ADD COLUMN rows_rejected INTEGER NOT NULL DEFAULT 0, ADD COLUMN control_total NUMERIC(18,2);

-- Rows a parser refused (error cell, bad date, missing key), kept so nothing disappears silently.
CREATE TABLE stg.rejected_rows(id SERIAL PRIMARY KEY, import_id INTEGER NOT NULL REFERENCES app.imports(id) ON DELETE CASCADE,
  sheet TEXT NOT NULL DEFAULT '', row_no INTEGER NOT NULL, reason TEXT NOT NULL, raw JSONB NOT NULL DEFAULT '{}', created TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX rejected_rows_import ON stg.rejected_rows(import_id);

-- Reporting views: stable names, real dates, no app internals. Excel and Power BI read only these.
CREATE VIEW rpt.restaurant_daily AS
  SELECT c.name AS company, b.name AS branch, r.date, r.line AS payment_channel, r.value AS amount_qar
  FROM app.daily_receipts r JOIN app.companies c ON c.id = r.company_id JOIN app.branches b ON b.id = r.branch_id;
CREATE VIEW rpt.stay_daily AS
  SELECT c.name AS company, b.name AS branch, d.date, d.long_guests, d.long_rate, d.long_total, d.short_guests, d.short_rate, d.short_total,
    d.rooms_occupied, d.rooms_available, d.room_revenue AS room_revenue_qar, d.other_revenue AS other_revenue_qar
  FROM app.daily_sales d JOIN app.companies c ON c.id = d.company_id LEFT JOIN app.branches b ON b.id = d.branch_id;
CREATE VIEW rpt.monthly_figures AS
  SELECT c.name AS company, b.name AS branch, f.section, f.period, f.main AS category, f.line, f.unit_type, f.value AS amount
  FROM app.company_figures f JOIN app.companies c ON c.id = f.company_id LEFT JOIN app.branches b ON b.id = f.branch_id;
CREATE VIEW rpt.calendar AS SELECT date, year, month, day, month_start, iso_week, day_name, is_working_day FROM app.dim_calendar;
`;

// A row can be refused (loaded = false), or kept but need a person to check it (loaded = true), e.g. a typed Gross Sales that disagrees with its channels.
const REJECTED_ROWS_LOADED = `
ALTER TABLE stg.rejected_rows ADD COLUMN loaded BOOLEAN NOT NULL DEFAULT false;
`;

// Monthly cost of goods per restaurant. Cost % is calculated in the view, never stored. Costs are negative, so -cogs / net is the percentage.
const RESTAURANT_COGS = `
ALTER TABLE app.imports DROP CONSTRAINT imports_section_check;
ALTER TABLE app.imports ADD CONSTRAINT imports_section_check CHECK (section IN ('pnl','sales','units','daily','balance','budget','people','expenses','receipts','cogs'));
ALTER TABLE app.company_figures DROP CONSTRAINT company_figures_section_check;
ALTER TABLE app.company_figures ADD CONSTRAINT company_figures_section_check CHECK (section IN ('pnl','sales','units','balance','budget','people','expenses','cogs'));
INSERT INTO app.accounts(section, main, sub) VALUES ('cogs','COGS','Gross sales'), ('cogs','COGS','Discount'), ('cogs','COGS','Net sales'), ('cogs','COGS','CPU transfer'),
  ('cogs','COGS','Stock GL balance'), ('cogs','COGS','Closing inventory'), ('cogs','COGS','COGS');
CREATE VIEW rpt.restaurant_cogs_month AS
  SELECT c.name AS company, b.name AS branch, f.period,
    SUM(f.value) FILTER (WHERE f.line = 'Gross sales') AS gross_sales_qar,
    SUM(f.value) FILTER (WHERE f.line = 'Discount') AS discount_qar,
    SUM(f.value) FILTER (WHERE f.line = 'Net sales') AS net_sales_qar,
    SUM(f.value) FILTER (WHERE f.line = 'CPU transfer') AS cpu_transfer_qar,
    SUM(f.value) FILTER (WHERE f.line = 'Stock GL balance') AS stock_gl_balance_qar,
    SUM(f.value) FILTER (WHERE f.line = 'Closing inventory') AS closing_inventory_qar,
    SUM(f.value) FILTER (WHERE f.line = 'COGS') AS cogs_qar,
    round(-SUM(f.value) FILTER (WHERE f.line = 'COGS') / NULLIF(SUM(f.value) FILTER (WHERE f.line = 'Net sales'), 0) * 100, 2) AS cost_pct
  FROM app.company_figures f JOIN app.companies c ON c.id = f.company_id LEFT JOIN app.branches b ON b.id = f.branch_id
  WHERE f.section = 'cogs' GROUP BY c.name, b.name, f.period;
`;

// The app stopped using ownership % on 2026-11-04, but the column was never dropped from databases that already had it.
const DROP_OWNERSHIP_PCT = `
ALTER TABLE app.companies DROP COLUMN IF EXISTS ownership_pct;
`;

// FMCG reference data, keyed by the ERP's own codes. Salesman assignments are one snapshot per month, so last month's reporting lines never change when someone moves team.
const FMCG_MASTERS = `
ALTER TABLE app.imports DROP CONSTRAINT imports_section_check;
ALTER TABLE app.imports ADD CONSTRAINT imports_section_check CHECK (section IN ('pnl','sales','units','daily','balance','budget','people','expenses','receipts','cogs','masters'));
ALTER TABLE app.brands ADD COLUMN department TEXT, ADD COLUMN manager TEXT, ADD COLUMN category TEXT;
CREATE TABLE app.salesmen(code TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active', team_lead TEXT, manager TEXT, sales_category TEXT, route TEXT,
  import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE app.customers(code TEXT PRIMARY KEY, name TEXT NOT NULL, group_name TEXT, credit_days INTEGER, accountant TEXT, status TEXT NOT NULL,
  import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE app.items(code TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL REFERENCES app.brands(code) ON UPDATE CASCADE, packing TEXT, size TEXT, item_type TEXT, department TEXT, manager TEXT,
  import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE app.sales_assignments(period DATE NOT NULL CHECK (EXTRACT(day FROM period) = 1), salesman_code TEXT NOT NULL REFERENCES app.salesmen(code), brand TEXT NOT NULL REFERENCES app.brands(code) ON UPDATE CASCADE,
  supervisor TEXT, channel TEXT, department TEXT, target NUMERIC(18,2), import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(period, salesman_code, brand));
CREATE TABLE app.manager_targets(period DATE NOT NULL CHECK (EXTRACT(day FROM period) = 1), manager TEXT NOT NULL, target NUMERIC(18,2) NOT NULL,
  import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(period, manager));
CREATE VIEW rpt.salesmen AS SELECT code, name, status, team_lead, manager, sales_category, route FROM app.salesmen;
CREATE VIEW rpt.customers AS SELECT code, name, group_name, credit_days, accountant, status FROM app.customers;
CREATE VIEW rpt.items AS SELECT i.code, i.name, i.brand, b.manager AS brand_manager, i.packing, i.size, i.item_type, i.department FROM app.items i JOIN app.brands b ON b.code = i.brand;
CREATE VIEW rpt.brands AS SELECT code, name, department, manager, category FROM app.brands;
CREATE VIEW rpt.sales_targets AS SELECT a.period, a.salesman_code, s.name AS salesman, a.brand, a.supervisor, a.channel, a.department, a.target AS target_qar, s.status AS salesman_status FROM app.sales_assignments a JOIN app.salesmen s ON s.code = a.salesman_code;
CREATE VIEW rpt.manager_targets AS SELECT period, manager, target AS target_qar FROM app.manager_targets;
`;

// Workbook aliases on companies and branches, account kind/sign metadata on the chart, and one monthly revenue view across all sources.
const DATA_STANDARDIZATION = `
ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE app.branches ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';
UPDATE app.companies SET aliases = ARRAY['burger stop'] WHERE lower(name) LIKE '%burger stop%' AND aliases = '{}';
UPDATE app.companies SET aliases = ARRAY['asian wok old airport', 'asian wok'] WHERE lower(name) LIKE '%asian wok%' AND aliases = '{}';
UPDATE app.branches SET aliases = ARRAY['West Bay', 'Westbay'] WHERE lower(name) = 'qatar sports club' AND aliases = '{}';
UPDATE app.branches SET aliases = ARRAY['Mr.Shawarma Bin Omran'] WHERE lower(name) = 'bin omran' AND aliases = '{}';
UPDATE app.branches SET aliases = ARRAY['Mr.Shawarma Gharafa'] WHERE lower(name) = 'gharafa' AND aliases = '{}';
UPDATE app.branches SET aliases = ARRAY['Abu Hamour'] WHERE lower(name) = 'abu hamour' AND aliases = '{}';

ALTER TABLE app.accounts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense'
    CHECK (kind IN ('revenue','expense','asset','liability','equity','metric')),
  ADD COLUMN IF NOT EXISTS normal_sign SMALLINT NOT NULL DEFAULT -1
    CHECK (normal_sign IN (-1, 1));
UPDATE app.accounts SET
  kind = CASE
    WHEN section IN ('pnl', 'sales') AND upper(main) = 'REVENUE' THEN 'revenue'
    WHEN section = 'budget' AND sub = 'Revenue' THEN 'revenue'
    WHEN section = 'units' AND sub = 'Room revenue' THEN 'revenue'
    WHEN section = 'cogs' AND sub IN ('Gross sales', 'Net sales') THEN 'revenue'
    WHEN section = 'balance' AND main = 'ASSETS' THEN 'asset'
    WHEN section = 'cogs' AND sub IN ('Stock GL balance', 'Closing inventory') THEN 'asset'
    WHEN section = 'balance' AND main = 'FUNDING' AND sub = 'Equity' THEN 'equity'
    WHEN section = 'balance' AND main = 'FUNDING' THEN 'liability'
    WHEN section IN ('people', 'units') OR (section = 'balance' AND main = 'MEMO') THEN 'metric'
    ELSE 'expense'
  END,
  normal_sign = CASE
    WHEN section = 'pnl' AND upper(main) <> 'REVENUE' THEN -1
    WHEN section = 'expenses' THEN -1
    WHEN section = 'budget' AND sub <> 'Revenue' THEN -1
    WHEN section = 'cogs' AND sub IN ('Discount', 'CPU transfer', 'COGS') THEN -1
    ELSE 1
  END;

CREATE OR REPLACE VIEW rpt.company_monthly_revenue AS
  SELECT c.id AS company_id, c.name AS company, c.sector, b.id AS branch_id, b.name AS branch,
    src.period, src.source, src.line, SUM(src.value) AS amount_qar
  FROM (
    SELECT f.company_id, f.branch_id, f.period, f.section AS source, f.line, f.value
    FROM app.company_figures f
    JOIN app.accounts a ON a.section = f.section AND a.main = f.main AND a.sub = f.line
    WHERE f.section IN ('pnl', 'sales') AND a.kind = 'revenue'
    UNION ALL
    SELECT d.company_id, d.branch_id, date_trunc('month', d.date)::date AS period, 'daily_sales' AS source, v.line, v.value
    FROM app.daily_sales d
    CROSS JOIN LATERAL (VALUES ('Room revenue', d.room_revenue), ('Other revenue', d.other_revenue)) v(line, value)
    UNION ALL
    SELECT r.company_id, r.branch_id, date_trunc('month', r.date)::date AS period, 'daily_receipts' AS source, 'Sales' AS line, r.value
    FROM app.daily_receipts r
    WHERE r.line <> 'Bank deposits'
  ) src
  JOIN app.companies c ON c.id = src.company_id
  LEFT JOIN app.branches b ON b.id = src.branch_id
  GROUP BY c.id, c.name, c.sector, b.id, b.name, src.period, src.source, src.line;
`;

const SALES_LINES_VIEW = `CREATE VIEW rpt.sales_lines AS SELECT "DOC_DATE" AS date, "DOC_NO" AS document_no, "DOC_TYPE" AS document_type, "DEPT_CODE" AS department_code,
  "SMAN_CODE" AS salesman_code, "SMAN_NAME" AS salesman, "CUST_NO" AS customer_code, "CUST_NAME" AS customer, "GROUP_NAME" AS customer_group, "CUST_CATEGORY" AS customer_category,
  upper(trim("BRAND")) AS brand, "ITEM_CODE" AS item_code, "ITEM_NAME" AS item, "SUPPLIER_NAME" AS supplier, "QTY_PCS" AS qty_pcs, "NET_AMOUNT" AS net_sales_qar, "NET_COST" AS net_cost_qar
  FROM public.invs_daily_sales_v`;
// Every month that has targets: target and actual per salesman and brand, including sales nobody set a target for. data_through shows how far the ERP view has been refreshed.
const SALES_VS_TARGET_VIEW = `CREATE VIEW rpt.sales_vs_target AS
  WITH actual AS (SELECT date_trunc('month', date)::date AS period, salesman_code, max(salesman) AS salesman, brand, SUM(net_sales_qar) AS sales FROM rpt.sales_lines GROUP BY 1, 2, 4)
  SELECT COALESCE(t.period, a.period) AS period, COALESCE(t.salesman_code, a.salesman_code) AS salesman_code, COALESCE(s.name, a.salesman) AS salesman, COALESCE(t.brand, a.brand) AS brand,
    t.supervisor, t.channel, t.department, t.target AS target_qar, COALESCE(a.sales, 0) AS sales_qar, round(a.sales / NULLIF(t.target, 0) * 100, 2) AS achieved_pct,
    (SELECT max(date) FROM rpt.sales_lines) AS data_through
  FROM app.sales_assignments t FULL JOIN actual a ON a.period = t.period AND a.salesman_code = t.salesman_code AND a.brand = t.brand
  LEFT JOIN app.salesmen s ON s.code = COALESCE(t.salesman_code, a.salesman_code)
  WHERE COALESCE(t.period, a.period) IN (SELECT period FROM app.sales_assignments)`;
// Only the live server has the ERP view (staging has none), so these views are created only where it exists. Read-only on the ERP side.
// shortcut: a database that gets the ERP view later won't have these views, add a new migration if staging ever gets it.
const ifErpView = (sql: string) => `DO 'BEGIN IF to_regclass(''public.invs_daily_sales_v'') IS NOT NULL THEN EXECUTE ''${sql.replaceAll("'", "''''")}''; END IF; END';`;
const FMCG_SALES_VIEWS = `${ifErpView(SALES_LINES_VIEW)}\n${ifErpView(SALES_VS_TARGET_VIEW)}`;

// Point-in-time balances: one set of rows per day the file was run, so yesterday's stock is still there tomorrow.
const FMCG_BALANCES = `
ALTER TABLE app.imports DROP CONSTRAINT imports_section_check;
ALTER TABLE app.imports ADD CONSTRAINT imports_section_check CHECK (section IN ('pnl','sales','units','daily','balance','budget','people','expenses','receipts','cogs','masters','balances'));
CREATE TABLE app.stock_snapshots(as_of DATE NOT NULL, item_code TEXT NOT NULL REFERENCES app.items(code), location TEXT NOT NULL, qty_current NUMERIC(18,2) NOT NULL, qty_allocated NUMERIC(18,2) NOT NULL,
  qty_balance NUMERIC(18,2) NOT NULL, value NUMERIC(18,2) NOT NULL, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(as_of, item_code, location));
CREATE TABLE app.salesman_outstanding(as_of DATE NOT NULL, account_code TEXT NOT NULL REFERENCES app.customers(code), posted_date DATE NOT NULL, doc_code TEXT, doc_no TEXT NOT NULL, party_ref TEXT NOT NULL DEFAULT '',
  department TEXT, balance NUMERIC(18,2) NOT NULL, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(as_of, account_code, doc_no, party_ref));
CREATE VIEW rpt.stock_daily AS SELECT s.as_of, s.as_of = (SELECT max(as_of) FROM app.stock_snapshots) AS is_latest, s.item_code, i.name AS item, i.brand, s.location, s.qty_current, s.qty_allocated, s.qty_balance, s.value AS value_qar
  FROM app.stock_snapshots s JOIN app.items i ON i.code = s.item_code;
CREATE VIEW rpt.salesman_outstanding AS SELECT o.as_of, o.as_of = (SELECT max(as_of) FROM app.salesman_outstanding) AS is_latest, o.account_code, c.name AS account, o.posted_date, o.doc_code, o.doc_no, o.party_ref, o.department, o.balance AS balance_qar, o.as_of - o.posted_date AS age_days,
  CASE WHEN o.as_of - o.posted_date <= 30 THEN '0-30' WHEN o.as_of - o.posted_date <= 60 THEN '31-60' WHEN o.as_of - o.posted_date <= 90 THEN '61-90' ELSE 'Over 90' END AS age_bucket
  FROM app.salesman_outstanding o JOIN app.customers c ON c.code = o.account_code;
`;

// Control reports, each kept as printed. Variances and shortages are calculated in the views, never stored. The Market Audit carries customer balances with no date, so the balance shows when it was last loaded.
const FMCG_CONTROL = `
ALTER TABLE app.customers ADD COLUMN balance NUMERIC(18,2);
CREATE OR REPLACE VIEW rpt.customers AS SELECT code, name, group_name, credit_days, accountant, status, balance AS balance_qar, updated AS balance_updated FROM app.customers;
CREATE TABLE app.delivery_variances(do_date DATE NOT NULL, do_no TEXT NOT NULL, item_code TEXT NOT NULL, location TEXT NOT NULL, customer_code TEXT, customer TEXT, salesman TEXT, store_in_charge TEXT, driver TEXT, item TEXT, brand TEXT, manager TEXT, supervisor TEXT,
  qty_rv NUMERIC(18,2) NOT NULL, qty_do NUMERIC(18,2) NOT NULL, value_rv NUMERIC(18,2) NOT NULL, value_do NUMERIC(18,2) NOT NULL, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(do_no, item_code, location));
CREATE TABLE app.consignment_receipts(received_date DATE NOT NULL, line_no INTEGER NOT NULL, consignment_no TEXT NOT NULL, order_no TEXT, invoice_no TEXT, invoice_date DATE, supplier TEXT, location TEXT, item_code TEXT NOT NULL, item TEXT, expiry_date DATE, excise TEXT,
  billed_qty NUMERIC(18,2) NOT NULL, received_qty NUMERIC(18,2) NOT NULL, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(received_date, line_no));
CREATE TABLE app.stock_expiry(as_of DATE NOT NULL, report TEXT NOT NULL, line_no INTEGER NOT NULL, item_code TEXT NOT NULL, item TEXT, size TEXT, packing TEXT, brand TEXT, category TEXT, location TEXT, cartons NUMERIC(18,2), outers NUMERIC(18,2), pieces NUMERIC(18,2),
  total_cost NUMERIC(18,2) NOT NULL, expiry_date DATE NOT NULL, remarks TEXT, import_id INTEGER REFERENCES app.imports(id) ON DELETE SET NULL, PRIMARY KEY(as_of, report, line_no));
CREATE VIEW rpt.delivery_variances AS SELECT do_date, do_no, item_code, item, brand, location, customer_code, customer, salesman, store_in_charge, driver, manager, supervisor, qty_rv, qty_do, qty_rv - qty_do AS qty_variance, value_rv AS value_rv_qar, value_do AS value_do_qar, value_rv - value_do AS value_variance_qar FROM app.delivery_variances;
CREATE VIEW rpt.consignment_receipts AS SELECT received_date, consignment_no, order_no, invoice_no, invoice_date, supplier, location, item_code, item, expiry_date, excise, billed_qty, received_qty, billed_qty - received_qty AS short_qty FROM app.consignment_receipts;
CREATE VIEW rpt.stock_expiry AS SELECT as_of, report, item_code, item, size, packing, brand, category, location, cartons, outers, pieces, total_cost AS total_cost_qar, expiry_date, expiry_date - as_of AS days_left,
  CASE WHEN expiry_date - as_of <= 30 THEN '0-30' WHEN expiry_date - as_of <= 60 THEN '31-60' WHEN expiry_date - as_of <= 90 THEN '61-90' ELSE 'Over 90' END AS age_bucket, remarks FROM app.stock_expiry;
`;

// Plain-column NULLS NOT DISTINCT keys (so IS NOT DISTINCT FROM uses the index), section/account/company indexes, and deduplicated upload blobs.
const APP_OPTIMIZATIONS = `
DROP INDEX app.company_figures_key;
ALTER TABLE app.company_figures ADD CONSTRAINT company_figures_key UNIQUE NULLS NOT DISTINCT (company_id, branch_id, section, period, main, line, unit_type);
DROP INDEX app.daily_sales_key;
ALTER TABLE app.daily_sales ADD CONSTRAINT daily_sales_key UNIQUE NULLS NOT DISTINCT (company_id, branch_id, date);
CREATE INDEX company_figures_section_period ON app.company_figures(section, company_id, period);
CREATE INDEX company_figures_account ON app.company_figures(section, main, line);
CREATE INDEX daily_receipts_company_date ON app.daily_receipts(company_id, date DESC);
CREATE TABLE app.import_files(sha256 TEXT PRIMARY KEY, file BYTEA NOT NULL);
UPDATE app.imports SET sha256 = encode(sha256(file), 'hex') WHERE file IS NOT NULL AND sha256 = '';
INSERT INTO app.import_files(sha256, file)
  SELECT DISTINCT ON (sha256) sha256, file FROM app.imports WHERE file IS NOT NULL
  ON CONFLICT (sha256) DO NOTHING;
ALTER TABLE app.imports DROP COLUMN file;
DO 'BEGIN IF to_regclass(''app.sector_expenses'') IS NOT NULL THEN PERFORM 1 / (CASE WHEN EXISTS (SELECT 1 FROM app.sector_expenses) THEN 0 ELSE 1 END); DROP TABLE app.sector_expenses; END IF; END';
`;

// People allowed to sign in. Admins are not stored here: they come from the ADMIN_EMAILS setting.
const APP_USERS = `
CREATE TABLE app.users(
  email TEXT PRIMARY KEY CHECK (email = lower(btrim(email))),
  created TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// TC outstanding and invoices not yet converted to delivery orders now come straight from the ERP tables, not from uploaded Excel. rpt.salesman_outstanding keeps its name so reports built on it still work.
const ERP_OUTSTANDING = `
DROP VIEW IF EXISTS rpt.salesman_outstanding;
DROP TABLE IF EXISTS app.salesman_outstanding;
DO $$ BEGIN IF to_regclass('public.glas_food_cust_oustanding_inv') IS NOT NULL THEN EXECUTE $view$
CREATE VIEW rpt.salesman_outstanding AS SELECT current_date AS as_of, true AS is_latest, COALESCE("ACTUAL_CUSTOMER", "SLTR_SLMAST_ACNO") AS account_code, COALESCE("ACTUAL_CUST_NAME", "COAD_PTY_FULL_NAME") AS account,
  "SALESMAN_NAME" AS salesman, "MANAGER_NAME" AS manager, "PSTNG_DATE1" AS posted_date, "DUE_DATE" AS due_date, "SLTR_DOC_CODE" AS doc_code, "SLTR_OUR_DOC_NO" AS doc_no, COALESCE("SLTR_PTY_REF_NO", '') AS party_ref,
  "FIN_DEPT" AS department, "BALANCE_AMOUNT" AS balance_qar, current_date - "PSTNG_DATE1" AS age_days,
  CASE WHEN current_date - "PSTNG_DATE1" <= 30 THEN '0-30' WHEN current_date - "PSTNG_DATE1" <= 60 THEN '31-60' WHEN current_date - "PSTNG_DATE1" <= 90 THEN '61-90' ELSE 'Over 90' END AS age_bucket
  FROM public.glas_food_cust_oustanding_inv WHERE "CUSTOMER_TYPE" = 'Account Receivable - SALESMAN'
$view$; END IF; END $$;
`;

// The ERP sales table (invs_fdd_fnb_sales_do_t) is loaded with every document several times and holds all document types, so the app reads this copy instead:
// identical rows once, only IN-DTS, IN-OT and CR, amounts without tax under the old NET_AMOUNT / NET_COST names. Refresh it after each ERP load: scripts/refresh-sales.mjs.
// shortcut: a copy refreshed by hand, upgrade to a scheduled refresh (or drop this once the ERP load stops duplicating rows).
const ifTable = (table: string, sql: string) => `DO 'BEGIN IF to_regclass(''${table}'') IS NOT NULL THEN EXECUTE ''${sql.replaceAll("'", "''''")}''; END IF; END';`;
const SALES_CLEAN = [
  `CREATE MATERIALIZED VIEW app.sales_clean AS SELECT "DOC_DATE", "DOC_TYPE", "DOC_NO", "CUST_NO", "CUST_NAME", "CUST_CATEGORY", "GROUP_NAME", "BRAND", "ITEM_CODE", "ITEM_NAME", "SUPPLIER_NAME", "SMAN_NAME", "DEPT_CODE", "ROUTE_DESC", "DRIVER_NAME", "QTY_PCS", "NET_AMOUNT_WOT" AS "NET_AMOUNT", "NET_COST_WOT" AS "NET_COST"
     FROM (SELECT DISTINCT * FROM public.invs_fdd_fnb_sales_do_t WHERE "DOC_TYPE" IN ('IN-DTS','IN-OT','CR')) x`,
  `CREATE INDEX sales_clean_doc_date ON app.sales_clean("DOC_DATE")`,
].map((sql) => ifTable("public.invs_fdd_fnb_sales_do_t", sql)).join("\n");

const MIGRATIONS: readonly (readonly [string, string])[] = [["001_baseline", BASELINE], ["002_standard_data", STANDARD_DATA], ["003_drop_report_files", DROP_REPORT_FILES], ["005_company_expenses", COMPANY_EXPENSES], ["006_company_branches", COMPANY_BRANCHES], ["007_company_has_branches", COMPANY_HAS_BRANCHES], ["008_daily_receipts", DAILY_RECEIPTS], ["009_drop_deals", DROP_DEALS], ["010_drop_invoices", DROP_INVOICES], ["011_enterprise_foundation", ENTERPRISE_FOUNDATION], ["012_rejected_rows_loaded", REJECTED_ROWS_LOADED], ["013_restaurant_cogs", RESTAURANT_COGS], ["014_drop_ownership_pct", DROP_OWNERSHIP_PCT], ["015_fmcg_masters", FMCG_MASTERS], ["016_data_standardization", DATA_STANDARDIZATION], ["017_fmcg_sales_views", FMCG_SALES_VIEWS], ["018_fmcg_balances", FMCG_BALANCES], ["019_fmcg_control", FMCG_CONTROL], ["020_app_optimizations", APP_OPTIMIZATIONS], ["021_app_users", APP_USERS], ["022_erp_outstanding", ERP_OUTSTANDING], ["023_sales_clean", SALES_CLEAN]];

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
