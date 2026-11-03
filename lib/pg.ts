import { Pool } from "pg";

const g = globalThis as unknown as { _pg?: Pool };

export const pg = (g._pg ??= new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  max: 4,
  connectionTimeoutMillis: 8000,
}));
