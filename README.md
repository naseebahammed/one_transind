# One Transind

Next.js 16 dashboard for sales (from a read-only Postgres view), deals, companies and the Al Manzil hotel P&L.

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
| `SALES_PERIOD` | no | `YYYY-MM` pins "this month". Default: the latest complete month in the table. |
| `OPENAI_API_KEY` | no | Turns on the "Ask" box. `OPENAI_MODEL` picks the model (default `gpt-4o-mini`). |
| `DB_INIT` | production only | `true` creates the `app` schema and loads seed data when the server starts. |

## Database setup

The app keeps its own tables in the `app` schema. In development they are created and seeded on the first request.
In production this is skipped. Start the server once with `DB_INIT=true` on first deploy and after any change to `lib/schema.ts`, open a page, then remove it.

## Al Manzil P&L

Figures live in `data/al-manzil.csv` and `data/al-manzil-daily.csv` on the server's disk. Edits and uploads from the admin pages write that file, so run a single instance with a writable disk.
