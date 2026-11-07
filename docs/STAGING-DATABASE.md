# Testing safely: a staging copy of the database

**Why:** `.env.local` points at the live database, and `npm run dev` applies any new migration (006, 007, 008 are new) on the first page request. Test on a copy first.

You need the PostgreSQL command-line tools (`pg_dump`, `pg_restore`, `createdb`, `psql`). Run these in a terminal. Replace the bracketed words. Never write the password into a file in the project.

## 1. Back up the live database (read-only, safe)
```bash
pg_dump -h [live-host] -U [user] -d [live-db] -n app -Fc -f backups/app-before-branches-2026-11-07.dump
```
`-n app` saves only the app schema. The ERP view in `public` is not copied.

## 2. Create an empty staging database on the SAME server or a local one
```bash
createdb -h [staging-host] -U [user] transind_staging
```
Prefer a local Postgres on your PC, so it can never touch the live server.

## 3. Restore the backup into staging
```bash
pg_restore -h [staging-host] -U [user] -d transind_staging --no-owner backups/app-before-branches-2026-11-07.dump
```
Staging has no ERP sales view. The sales pages will be empty or error; the company, branch and receipts pages work. If you need sales too, create a small table or view with the same name as `SALES_TABLE`.

## 4. Point the app at staging WITHOUT editing `.env.local`
Values set in the terminal win over `.env.local`. In PowerShell, in the same window where you start the app:
```powershell
$env:PGHOST="[staging-host]"; $env:PGDATABASE="transind_staging"; $env:PGUSER="[user]"; $env:PGPASSWORD="[password]"
npm run dev
```
Close that window afterwards. A new window goes back to the live settings.

**Check before opening any page:** run `psql -h [staging-host] -U [user] -d transind_staging -c "select current_database()"`. It must say `transind_staging`. Also compare `PGHOST` with the host in `.env.local`.

## 5. What to test
- Migrations apply: `select id from app.schema_migrations order by id` ends with `008_daily_receipts`.
- Mark a company as having branches, add a branch, upload the Daily Sales Deposit workbook, and check the totals against the sheet.
- Re-upload with one number cleared: today the old number stays (review finding 4).

## 6. Going live
Only after staging works: back up live again (step 1), then start the app once against live and open one page. Migrations run once and are recorded. Production needs `DB_INIT=true` for that first start (see README).

## Not covered
Automatic backups on a schedule. Ask IT to run step 1 nightly with a date in the file name.
