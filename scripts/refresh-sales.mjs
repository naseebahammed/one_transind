// Re-reads the ERP sales table into app.sales_clean. Run after every ERP load: node --env-file=.env.local scripts/refresh-sales.mjs
import pg from "pg";
const c = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false });
await c.connect();
await c.query("REFRESH MATERIALIZED VIEW app.sales_clean");
console.log("app.sales_clean refreshed:", (await c.query("SELECT count(*) FROM app.sales_clean")).rows[0]);
await c.end();
