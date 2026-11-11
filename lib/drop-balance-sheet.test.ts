import assert from "node:assert/strict";
import test from "node:test";
import { migrate } from "./schema.ts";

test("027_drop_balance_sheet only deletes balance-section rows", async () => {
  const executed: { sql: string; params?: unknown[] }[] = [];
  await migrate({
    query: async (sql, params) => {
      executed.push({ sql, params });
      return { rows: sql.startsWith("SELECT id FROM app.schema_migrations") ? [] : [] };
    },
  }, "027_drop_balance_sheet");
  const step = executed.find((s) => s.sql.includes("DELETE FROM app.accounts WHERE section = 'balance'"));
  assert.ok(step, "expected the balance clean-up SQL to run");
  for (const statement of step.sql.trim().split("\n")) assert.match(statement, /^DELETE FROM app\.\w+ WHERE section = 'balance';$/);
  assert.doesNotMatch(step.sql, /DROP|TRUNCATE|ALTER/i);
});
