import type { PoolClient } from "pg";
import { SECTORS } from "@/lib/org";
import { PROPERTY_TYPES } from "@/lib/company-input";
import { ACCOUNT_SEED } from "@/lib/accounts-seed";
import { pg } from "@/lib/pg";
import { migrate } from "@/lib/schema";

async function init() {
  const c = await pg.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7451)"); // concurrent first requests/instances must not double-seed
    await migrate(c);
    const empty = async (t: string, where = "") => !(await c.query(`SELECT 1 FROM app.${t} ${where} LIMIT 1`)).rowCount;
    if (await empty("sectors")) for (const [k, v] of SECTORS) await c.query("INSERT INTO app.sectors VALUES($1,$2)", [k, v]);
    if (await empty("property_types")) for (const [k, v] of PROPERTY_TYPES) await c.query("INSERT INTO app.property_types VALUES($1,$2)", [k, v]);
    if (await empty("accounts", "WHERE section='pnl'")) {
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
const g = globalThis as unknown as { _dbReady?: Promise<void> };
// Production skips schema/seed on requests: run once per deploy with DB_INIT=true.
const autoInit = process.env.NODE_ENV !== "production" || process.env.DB_INIT === "true";
const ready = () => (g._dbReady ??= (autoInit ? init() : Promise.resolve()).catch((e) => ((g._dbReady = undefined), Promise.reject(e))));

/** Run SQL against the app schema (tables are `app.<name>`); returns the rows. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  await ready();
  return (await pg.query(text, params)).rows as T[];
}
/** Run fn in one transaction under an app-wide lock, so "max + 1" numbers cannot collide between concurrent requests. */
export async function numbering<T>(fn: (c: PoolClient) => Promise<T>) {
  await ready();
  const c = await pg.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(7452)");
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
  const [{ t }] = await q<{ t: string }>("INSERT INTO app.log(job,ok,n) VALUES($1,$2,$3) RETURNING to_char(at AT TIME ZONE 'Asia/Qatar','YYYY-MM-DD HH24:MI') AS t", [job, ok ? 1 : 0, n]);
  return { t, job, ok, n };
};
export const listInvoices = (customerId?: string | null) =>
  customerId ? q('SELECT * FROM app.invoices WHERE "customerId"=$1', [customerId]) : q("SELECT * FROM app.invoices");
