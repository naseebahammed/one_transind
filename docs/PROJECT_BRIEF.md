# One Transind: project brief (for handing to another AI)

_Written 2026-11-07 from the code on branch `feat/mr-shawarma-daily-sheet`. No database was queried; the table list is read from `lib/schema.ts` (all migrations applied in order)._

## 1. What it is
Internal management and analytics web app for **Transind Holding** (Qatar). Used by leadership, finance, operations/property managers and admins. It shows:
- **Sales analytics** from a read-only ERP Postgres view (brands, items, customers, departments, routes, credit notes, cost/margin).
- **Company financials** typed or uploaded by each subsidiary: P&L, balance sheet and cash, budget, people/headcount, expenses, units/rooms.
- **Hotel / property occupancy** from daily stay reports (occupancy and average rate are calculated, never stored).
- **Branch daily takings** (e.g. Mr. Shawarma: cash, card, Talabat, Snoonu, Deliveroo, Keeta, bank deposits).
- An optional OpenAI "Ask" box. (The old deals pipeline page has been removed; its tables remain.)

Rules: amounts in QAR; revenue positive, costs negative; a missing monthly row = not submitted, 0 = verified zero; no `$` symbol anywhere.

## 2. Tech stack
Next.js 16.4 (App Router, Server Components + Server Actions + a few Route Handlers), React 19.3, TypeScript, Tailwind v4 + Radix (admin) and hand-written CSS (business pages), `pg` (pool max 4), `exceljs` for xlsx upload/templates, Node native test runner (`node --test lib/*.test.ts`). PostgreSQL. On-premise Windows server, no auth. Optional OpenAI (`gpt-4o-mini` default).

## 3. Layout
- `app/(app)/` business pages: dashboard, sales, finance, real-estate (overview/details), retail, restaurants, health-beauty, trading, logistics, customers, hr.
- `app/admin/` accounts (chart of accounts), activity log, al-manzil, companies (+ new, [id]), company-types, data-status, finance, sales-sectors, sectors.
- `app/api/` ask, companies/[id]/logo + template, customers, imports/[id], invoices, sales.
- `lib/` all logic: `schema.ts` (migrations), `db.ts`/`pg.ts`, `data.ts` (ERP sales SQL), `company-figures.ts`, `company-data.ts`, `report-parsers.ts` (workbook readers), `reports.ts` (loading + calcs), `receipts.ts`, `branches.ts`, `org.ts` (SECTOR constants), `period*.ts`, tests.
- `docs/`, `scripts/migrate-report-files.ts`, `refactoring_plan.md`, `architecture_review.md`, `DESIGN.md`.

Data flow for uploads: .xlsx/.csv (max 5 MB) is validated whole, saved in one transaction (months/days in the file replaced, the rest untouched), and every attempt, even rejected, is stored with the original file in `app.imports`.

## 4. Where the work stands
Done (commits on branch): split of `al-manzil.ts` into `report-parsers.ts` + `reports.ts`, sector constants, full-word renames of sales data shapes, naming rules in CLAUDE.md, baseline tests, five-section company page (Profile, P&L, Balance, Budget, People) with templates + upload + status, company figures with `branch_id`.

**In progress, uncommitted (about 18 modified + 6 new files):** branches per company (`has_branches`, `BranchesCard`, `branch-actions.ts`), Mr. Shawarma "Daily Sales Deposit" sheet (`daily_receipts`, `receipts.ts`, `ReceiptsSectionView`, parser + tests in `report-parsers.ts`), migrations 006, 007, 008.

## 5. Full plan (from `refactoring_plan.md`; business logic must not change)
| Step | What | Risk | Status |
|---|---|---|---|
| 0 | Safety-net tests (`report`, `occupancy`, `revenueLines`, finance totals), staging DB copy | none | baseline tests done; finance-summary tests wait for step 5 |
| 1 | Named sector keys (`SECTOR`) and Al Manzil lookup constant | very low | done |
| 2 | Naming rules + rename cryptic fields (`v`, `lm`, `ly`, `ly2`, `c`, `u`, `cr`) | low | data.ts shapes and big pages done |
| 3 | Split `al-manzil.ts` into parsers and reports | low | done |
| 4 | Move SQL out of server actions and API routes into `lib/` (sectors, property-types, accounts, sales-sectors, companies, `getImportFile`; skip the deals routes, they are gone) | medium | not started |
| 5 | Thin big pages: `lib/finance-summary.ts`; dashboard and real-estate overview totals | medium | not started |
| 6 | Replace module-level `snap` in `loadReports()` with a per-request cached value passed to `report()` | medium-high | not started |
| 7 | Retire `/legacy`, `public/app.js`, `td.js`, `/api/bootstrap`, `/api/deals*` | - | already done; `/api/sales`, `/api/customers`, `/api/invoices` and tables `app.deals`, `app.invoices` remain, usage unchecked |
| Not planned yet | Login/access control, company picker instead of Al Manzil name match, one UI system, `q`/`q1` renames, performance | | |

## 6. Upgrades worth asking the other AI about
1. **Authentication and roles** (biggest risk: no login, `/admin` and `/api/ask` open to the network, `.env.local` points at the live DB).
2. Tests for DB code (migrations, `company-figures.ts`, `data.ts`); today only pure helpers are tested.
3. Report loading loads every company's figures on every request: cache / load only what a page needs.
4. Approval workflow and reminders for monthly submissions (status today is only Submitted / Not submitted / Not due).
5. Check whether `/api/sales`, `/api/customers`, `/api/invoices` and the `app.deals` / `app.invoices` tables are still used (the legacy dashboard is already gone).
6. Dev/staging DB separate from production; backup/restore routine.
7. Al Manzil is found by `lower(name) LIKE 'al manzil%'`: replace with `erp_code` or an id.
8. Migration numbering skips `004` (001, 002, 003, 005...): harmless but confusing.

## 7. Database
Schema `app` (app-owned, read/write) and `public` (ERP, read-only). Migrations: `001_baseline`, `002_standard_data`, `003_drop_report_files`, `005_company_expenses`, `006_company_branches`, `007_company_has_branches`, `008_daily_receipts`.

### app.sectors
`key` TEXT PK, `name` TEXT NOT NULL. Keys used in code: fmcg, fnb, re, retail, hb.

### app.property_types
`key` TEXT PK, `name` TEXT NOT NULL.

### app.companies
| column | type | notes |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT NOT NULL | unique on lower(name) |
| sector | TEXT NOT NULL | FK app.sectors(key), ON UPDATE CASCADE |
| active | INTEGER NOT NULL DEFAULT 1 | |
| room_types | JSONB NOT NULL DEFAULT '[]' | hotels |
| total_rooms | INTEGER NOT NULL DEFAULT 0 | |
| hidden | INTEGER NOT NULL DEFAULT 0 | |
| property_type | TEXT NOT NULL DEFAULT '' | |
| logo | BYTEA | |
| logo_type | TEXT | |
| erp_code | TEXT NOT NULL DEFAULT '' | |
| has_branches | INTEGER NOT NULL DEFAULT 0 | added in 007 |

### app.branches (006)
`id` SERIAL PK, `company_id` INTEGER NOT NULL FK companies ON DELETE CASCADE, `name` TEXT NOT NULL, `active` INTEGER NOT NULL DEFAULT 1. Unique (company_id, lower(name)).

### app.accounts (chart of lines)
`id` SERIAL PK, `main` TEXT, `sub` TEXT, `main_order` INTEGER DEFAULT 0, `section` TEXT DEFAULT 'pnl'. Unique (section, main, sub) and unique (section, lower(main), lower(sub)). Seeded for sections: pnl (managed in admin), balance (cash at bank, receivables ageing x5, stock, fixed assets, other assets, payables ageing x5, loan balance, other liabilities, equity, loan repayments due in 12 months), budget (Revenue, Direct cost, Overheads), people (Headcount, Payroll cost, Joiners, Leavers), sales (Sales), units (Available, Long stay, Short stay, Room revenue), expenses (Expenses).

### app.company_figures (every monthly number)
| column | type | notes |
|---|---|---|
| company_id | INTEGER NOT NULL | FK companies ON DELETE CASCADE |
| branch_id | INTEGER NULL | FK branches; NULL = whole company |
| section | TEXT NOT NULL | CHECK in pnl, sales, units, balance, budget, people, expenses |
| period | DATE NOT NULL | CHECK day = 1 |
| main | TEXT NOT NULL | |
| line | TEXT NOT NULL | FK (section, main, line) to accounts(section, main, sub) ON UPDATE CASCADE |
| unit_type | TEXT NOT NULL DEFAULT '' | |
| value | NUMERIC(18,2) NOT NULL | |
| import_id | INTEGER | FK imports ON DELETE SET NULL; NULL = typed by hand |
| updated | TIMESTAMPTZ DEFAULT now() | |

Unique index `company_figures_key` on (company_id, COALESCE(branch_id,0), section, period, main, line, unit_type).

### app.imports (one row per upload attempt)
`id` SERIAL PK, `company_id` FK CASCADE, `section` (CHECK pnl, sales, units, daily, balance, budget, people, expenses, receipts), `source` ('upload','legacy','erp'), `file_name`, `file_type`, `file_size`, `sha256`, `file` BYTEA, `status` ('loaded','rejected'), `error`, `rows_loaded`, `period_from` DATE, `period_to` DATE, `uploaded_by`, `created` TIMESTAMPTZ. Index (company_id, created DESC).

### app.daily_sales (hotel daily stay report)
`company_id` FK CASCADE, `branch_id` INTEGER NULL FK branches, `date` DATE, `long_guests`, `long_rate`, `long_total`, `short_guests`, `short_rate`, `short_total`, `rooms_occupied`, `room_revenue`, `other_revenue`, `rooms_available` (all NUMERIC(18,2) NOT NULL DEFAULT 0), `import_id` FK SET NULL, `updated`. Unique (company_id, COALESCE(branch_id,0), date). CHECK (rooms_available = 0 OR rooms_occupied <= rooms_available), NOT VALID.

### app.daily_receipts (008, branch daily takings)
`company_id` FK CASCADE, `branch_id` INTEGER NOT NULL FK branches, `date` DATE, `line` TEXT (channel, e.g. Cash sales, Credit card sales, Talabat cash, Snoonu, Deliveroo, Keeta, Bank deposits), `value` NUMERIC(18,2), `import_id` FK SET NULL, `updated`. PK (branch_id, date, line). Gross sales exclude "Bank deposits" and "Talabat discount".

### app.daily_sales_monthly (view)
company_id, period (month start), main, line, value: sums of daily_sales into GUESTS (Long stay, Short stay), REVENUE (Room revenue, Other revenue), ROOMS (Occupied, Available).

### app.deals: dropped by migration 009 (was the legacy pipeline; the migration refuses to run if it still has rows)
`seq` SERIAL, `id` TEXT PK, `sector` TEXT, `acc_ar` TEXT, `acc_en` TEXT, `cust` TEXT, `value` INTEGER, `stage` INTEGER, `owner` INTEGER, `close` TEXT, `so` TEXT.

### app.invoices: dropped by migration 010 (unused; the migration refuses to run if it still has rows)
`number` TEXT PK, `"customerId"` TEXT, `date` TEXT, `"dueDate"` TEXT, `amount` INTEGER, `balance` INTEGER, `bucket` TEXT.

### app.sales_departments
`code` TEXT PK, `label` TEXT, `hidden` INTEGER DEFAULT 0, `sector` TEXT.

### app.log (activity log)
`id` SERIAL PK, `job` TEXT, `ok` INTEGER, `n` INTEGER, `at` TIMESTAMPTZ DEFAULT now().

### app.schema_migrations
`id` TEXT PK, `applied` TIMESTAMPTZ DEFAULT now().

### Dropped (no longer exist)
`app.company_files` (002), `app.report_files` (003); old `company_figures` (year/month/line) replaced in 002.

### External ERP (READ ONLY, never write)
- `public.invs_daily_sales_v` (name from `SALES_TABLE`). Columns the code uses: `DOC_DATE`, `DOC_TYPE` ('CR' = credit note), `DOC_NO`, `NET_AMOUNT`, `NET_COST`, `QTY_PCS`, `CUST_NO`, `CUST_NAME`, `CUST_CATEGORY`, `GROUP_NAME`, `BRAND`, `ITEM_CODE`, `ITEM_NAME`, `DEPT_CODE`, `ROUTE_DESC`, `DRIVER_NAME`. (There may be more; check the view itself.)
- `public.invs_departments`: `department_code`, `department_name`.

## 8. Environment
`.env.local`: `PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSL, SALES_TABLE, SALES_PERIOD, OPENAI_API_KEY, OPENAI_MODEL, DB_INIT`. **`.env.local` points at the live database**, and dev start runs migrations: use a DB copy for experiments. Never paste its values to another AI.
