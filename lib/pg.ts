import { Pool, types } from "pg";
import { roundMoney } from "@/lib/money";
import { databaseConfig } from "@/lib/server-config";

if (typeof window !== "undefined") {
  throw new Error("lib/pg.ts is server-only and must never run in the browser.");
}

// Every NUMERIC / FLOAT column comes back as a number rounded to 2 decimals (pg returns NUMERIC as text by default).
for (const oid of [types.builtins.NUMERIC, types.builtins.FLOAT8, types.builtins.FLOAT4]) {
  types.setTypeParser(oid, (text) => roundMoney(parseFloat(text)));
}

const g = globalThis as unknown as { _pg?: Pool };

export const pg = (g._pg ??= new Pool({
  ...databaseConfig(),
  max: 10, // sales pages run ~8 heavy ERP queries in parallel; 4 made the rest queue and time out
  connectionTimeoutMillis: 30_000, // also covers waiting for a free pool slot, not just the TCP connect
  idleTimeoutMillis: 30_000,
  statement_timeout: 90_000, // aborts runaway queries so pool connections are never pinned indefinitely; 90 s because the cached sales queries take up to ~50 s when the database is slow
}));
