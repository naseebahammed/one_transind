import { Pool } from "pg";
import { databaseConfig } from "@/lib/server-config";

if (typeof window !== "undefined") {
  throw new Error("lib/pg.ts is server-only and must never run in the browser.");
}

const g = globalThis as unknown as { _pg?: Pool };

export const pg = (g._pg ??= new Pool({
  ...databaseConfig(),
  max: 10, // sales pages run ~8 heavy ERP queries in parallel; 4 made the rest queue and time out
  connectionTimeoutMillis: 30000, // also covers waiting for a free pool slot, not just the TCP connect
}));
