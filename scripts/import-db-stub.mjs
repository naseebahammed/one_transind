// Stands in for lib/db.ts while importing: runs every query on the one connection (and transaction) that import-all-data.mjs opened.
export async function q(text, params = []) {
  return (await globalThis.__importClient.query(text, params)).rows;
}
