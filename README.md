# One Transind

Next.js 16 dashboard for sales (from a read-only Postgres view), deals, and company finance data.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests for the pure helpers in lib/
```

Settings go in `.env.local`:

| Variable | Needed | What it does |
| --- | --- | --- |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | yes | Postgres connection. `PGPORT` defaults to 5432. |
| `PGSSL` | no | `true` turns on SSL. |
| `SALES_TABLE` | yes | The sales view the dashboard reads (columns `DOC_DATE`, `NET_AMOUNT`, `NET_COST`, ...). |
| `OPENAI_API_KEY` | no | Turns on the "Ask" box. `OPENAI_MODEL` picks the model (default `gpt-4o-mini`). |
| `DB_INIT` | production only | `true` creates the `app` schema and loads seed data when the server starts. |

## Database setup

The app keeps its own tables in the `app` schema. In development they are created and seeded on the first request.
In production this is skipped. Start the server once with `DB_INIT=true` on first deploy and after any change to `lib/schema.ts`, open a page, then remove it.

## Company data

Every monthly figure is one row in `app.company_figures` (section `pnl`, `sales`, `units`, `balance`, `budget` or `people`), and its line must exist in `app.accounts`. The daily stay report is `app.daily_sales`; a hotel's monthly sales are the view `app.daily_sales_monthly`. Revenue is positive, costs negative, amounts in QAR. No row means not submitted; 0 is a real zero.

Uploads (.xlsx or .csv, up to 5 MB) are validated as a whole, then saved in one transaction: the months or days in the file are replaced, everything else stays. Each attempt, including rejected ones, is kept with its original file in `app.imports` and listed under Admin > Activity log.

## Changing the database

Add a new entry to `MIGRATIONS` in `lib/schema.ts`; never edit one that has shipped. Each runs once and is recorded in `app.schema_migrations`.
