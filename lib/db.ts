import type { PoolClient } from "pg";
import { SECTORS } from "@/lib/org";
import { PROPERTY_TYPES } from "@/lib/company-input";
import { ACCOUNT_SEED } from "@/lib/accounts-seed";
import { cleanText } from "@/lib/input-validation";
import { pg } from "@/lib/pg";
import { LATEST_MIGRATION_ID, migrate } from "@/lib/schema";

const SEED_CHECK_SQL = {
  sectors: "SELECT 1 FROM app.sectors LIMIT 1",
  propertyTypes: "SELECT 1 FROM app.property_types LIMIT 1",
  pnlAccounts: "SELECT 1 FROM app.accounts WHERE section='pnl' LIMIT 1",
} as const;

async function init() {
  const c = await pg.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL statement_timeout = 0"); // the pool's 30 s limit is for page queries; a migration (e.g. rebuilding app.sales_clean) takes minutes
    await c.query("SELECT pg_advisory_xact_lock(7451)"); // concurrent first requests/instances must not double-seed
    await migrate(c);
    const empty = async (check: keyof typeof SEED_CHECK_SQL) => !(await c.query(SEED_CHECK_SQL[check])).rowCount;
    if (await empty("sectors")) for (const [k, v] of SECTORS) await c.query("INSERT INTO app.sectors VALUES($1,$2)", [k, v]);
    if (await empty("propertyTypes")) for (const [k, v] of PROPERTY_TYPES) await c.query("INSERT INTO app.property_types VALUES($1,$2)", [k, v]);
    if (await empty("pnlAccounts")) {
      let i = 0;
      for (const [m, subs] of Object.entries(ACCOUNT_SEED)) { i++; for (const s of subs) await c.query("INSERT INTO app.accounts(main,sub,main_order) VALUES($1,$2,$3)", [m, s, i]); }
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

// Lazy: connecting (and seeding) at import time collides across Next build workers.
// Keyed by LATEST_MIGRATION_ID so adding a new migration during `next dev` HMR runs migrate() on the next query without a server restart.
const g = globalThis as unknown as { _dbReady?: Promise<void>; _dbMigrationId?: string };
// Production skips schema/seed on requests: run once per deploy with DB_INIT=true.
const autoInit = process.env.NODE_ENV !== "production" || process.env.DB_INIT === "true";
const ready = () => {
  if (g._dbMigrationId !== LATEST_MIGRATION_ID) {
    g._dbReady = undefined;
    g._dbMigrationId = LATEST_MIGRATION_ID;
  }
  return (g._dbReady ??= (autoInit ? init() : Promise.resolve()).catch((e) => {
    g._dbReady = undefined;
    g._dbMigrationId = undefined;
    return Promise.reject(e);
  }));
};

/** Run SQL against the app schema (tables are `app.<name>`); returns the rows. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  await ready();
  return (await pg.query(text, params)).rows as T[];
}
/** Run fn in one transaction under an advisory lock (scoped to key when passed), so concurrent imports/edits do not collide. */
export async function numbering<T>(fn: (c: PoolClient) => Promise<T>, key = 0) {
  await ready();
  const c = await pg.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7452, $1)", [key]);
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export const q1 = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => (await q<T>(text, params))[0];

export const listLog = async () =>
  (await q<{ t: string; job: string; ok: number; n: number }>("SELECT to_char(at AT TIME ZONE 'Asia/Qatar','YYYY-MM-DD HH24:MI') AS t,job,ok,n FROM app.log ORDER BY id DESC LIMIT 50")).map((x) => ({ ...x, ok: !!x.ok }));
export const addLog = async (job: string, ok = true, n = 1) => {
  const safeJob = cleanText(job, 300);
  const safeCount = Number.isInteger(n) && n >= 0 ? n : 0;
  const [{ t }] = await q<{ t: string }>("INSERT INTO app.log(job,ok,n) VALUES($1,$2,$3) RETURNING to_char(at AT TIME ZONE 'Asia/Qatar','YYYY-MM-DD HH24:MI') AS t", [safeJob, ok ? 1 : 0, safeCount]);
  return { t, job: safeJob, ok, n: safeCount };
};
