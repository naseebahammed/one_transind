// Re-reads the ERP sales table into app.sales_clean and refreshes its rollups. Run after every ERP load: node --env-file=.env.local scripts/refresh-sales.mjs
import pg from "pg";
const c = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false });
await c.connect();
const t0 = Date.now();
await c.query("REFRESH MATERIALIZED VIEW app.sales_clean");
console.log(`app.sales_clean refreshed in ${Date.now() - t0}ms:`, (await c.query("SELECT count(*) FROM app.sales_clean")).rows[0]);
for (const view of ["app.sales_daily", "app.sales_monthly", "app.sales_daily_dims", "app.sales_customer_daily"]) {
  const { rows: [exists] } = await c.query("SELECT to_regclass($1)::text AS reg", [view]);
  if (exists?.reg) {
    const started = Date.now();
    await c.query(`REFRESH MATERIALIZED VIEW ${view}`);
    console.log(`${view} refreshed in ${Date.now() - started}ms:`, (await c.query(`SELECT count(*) FROM ${view}`)).rows[0]);
  }
}
await c.end();
