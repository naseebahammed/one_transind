# One Transind

## What this project is
One Transind is an internal management and analytics app for Transind Holding, built for leadership, finance, and operational teams across the group's subsidiary companies.
Purpose: Centralizes group-wide reporting, sales analytics from ERP views, financial statements (P&L, balance sheets, budgets, headcount), hotel and property occupancy tracking, and commercial pipeline deals across multiple sectors.
Main users and roles: Executive Leadership, Finance & Accounting Managers, Operations / Property Managers, and System Admins.

## Tech stack
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI primitives, Lucide React icons
- Backend: Next.js App Router (Server Components & Route Handlers), Node.js native test runner
- Database: PostgreSQL (dedicated `app` schema for internal data, read-only views for external ERP data)
- Hosting: On-premise Windows server / internal network deployment
- Authentication & Integrations: Environment-based database authentication; optional OpenAI API integration for dashboard "Ask" assistant

## Folder layout
- `app/` : Next.js App Router routes
  - `app/(app)/` : Business domain pages (dashboard, sales, finance, real-estate, customers, hr, logistics, retail, etc.)
  - `app/admin/` : Administration interfaces (company registry, accounts, data imports, activity log)
  - `app/api/` : API route handlers
- `components/` : Reusable UI components and administrative building blocks (tables, cards, forms, dialogs)
- `lib/` : Core business logic, data validators, database connectors (`pg.ts`, `db.ts`), schema definitions (`schema.ts`), and unit tests (`*.test.ts`)
- `data/` : Local reference data and initial seed assets
- `docs/` : Design specifications, mockups, and company data reporting templates
- `scripts/` : Migration and maintenance utility scripts
- `public/` : Static assets, company logos, and icons

## How to run it
- Install: `npm install`
- Start in development: `npm run dev` (runs on http://localhost:3000)
- Run tests: `npm test` (executes pure helper unit tests: `node --test lib/*.test.ts`)
- Build: `npm run build`
- Start in production: `npm run start` (set `DB_INIT=true` on initial deployment or schema migration)

## Database
- Tables so far:
  - App schema tables: `app.companies`, `app.sectors`, `app.property_types`, `app.accounts`, `app.company_figures`, `app.daily_sales`, `app.imports`, `app.sales_departments`, `app.schema_migrations`, `app.log`
  - Views: `app.daily_sales_monthly`
  - External ERP views: `public.invs_daily_sales_v` (configured via `SALES_TABLE` in `.env.local`)
- Naming conventions: snake_case table and column names, plural nouns for entity tables, `id` as primary key or explicit composite keys, timestamp fields (`created`, `updated`, `applied`).
- Schema changes always go through migration files. In this project, migrations are defined in the `MIGRATIONS` array in `lib/schema.ts`. Never edit a migration that has already shipped, and never edit the database structure by hand.
- Any company ERP or Oracle database view is READ-ONLY. Never write to it or attempt schema modifications on external tables.

## Working rules
- Ask before deleting files, dropping tables, changing the schema, or touching production data.
- Never put passwords, API keys, tokens, or connection strings in code or in this file. Use the `.env.local` / `.env` file, and never commit it.
- Work on a separate git branch. Do not push directly to main. The developer reviews changes before merging.
- Keep changes small and explain what was changed and why.
- Follow the existing code style. Do not add new libraries without asking.
- Run the tests (`npm test`) or start the app after making changes to check that nothing broke.

## Naming
- Exported functions, types and data fields use full words: `value`, `cost`, `lastMonth`, `lastYear`, `twoYearsAgo`, `units`, `creditNotes` — not `v`, `c`, `lm`, `ly`, `ly2`, `u`, `cr`. Standard finance terms (`ytd`, `mtd`) are fine.
- One- or two-letter names only inside a short lambda (`(r) => r.value`). A name that means different things in one file gets a different name each time.
- Files are `kebab-case.ts`, named after what they contain, not after one company.
- SQL tables and columns stay `snake_case`; TypeScript uses `camelCase`. The query's `AS` aliases are where they meet: they must match the row type's fields exactly, and camelCase aliases must be double-quoted (`AS "lastMonth"`), or Postgres lowercases them.
- Sector keys come from `SECTOR` in `lib/org.ts`, never as bare strings (`"re"`, `"hb"`).

## Notes for Claude
- The owner of this project is not a full-time developer, so explain technical choices in plain language.
- Another developer is also working in this codebase. Do not rewrite or reformat files you were not asked to change.
- **Design & Currency Rule**: Never use the dollar symbol — not as a currency sign in UI text, and not as an identifier/alias. Always use `QAR` for currency and descriptive variable names (e.g. `qs` instead of selector shortcuts).
- **Financial conventions**: Revenue is stored as positive numbers, costs as negative numbers. Amounts are in QAR. For monthly figures, a missing row means unsubmitted; 0 indicates a verified zero value.
- **Occupancy & Hotel calculations**: Occupancy rates and average daily rates are calculated on demand, never persisted in the database.
- **Next.js 16 conventions**: This project uses Next.js 16 and React 19. Ensure modern App Router APIs and server/client component boundaries are respected.

