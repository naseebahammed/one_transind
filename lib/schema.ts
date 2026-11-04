// App-owned tables live in their own schema so they never collide with the read-only business tables in public.
export const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS app;
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
