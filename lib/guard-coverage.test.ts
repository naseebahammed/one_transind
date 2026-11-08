import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const APP_DIR = join(import.meta.dirname, "..", "app");

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walkFiles(p) : /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

const files = walkFiles(APP_DIR).map((file) => ({ file, text: readFileSync(file, "utf8") }));
const show = (list: { file: string }[]) => list.map((f) => f.file.slice(APP_DIR.length)).join(", ");

test("every API route handler except the Auth.js one calls apiGuard", () => {
  const routes = files.filter((f) => /[\\/]api[\\/].*route\.ts$/.test(f.file) && !/[\\/]api[\\/]auth[\\/]/.test(f.file));
  assert.ok(routes.length >= 4, "found too few route handlers; the search is broken");
  const bad = routes.filter((f) => !f.text.includes("apiGuard("));
  assert.deepEqual(bad, [], `Unguarded route handlers: ${show(bad)}`);
});

test("the Users page actions require an admin, not just a signed-in user", () => {
  const actions = files.find((f) => /[\\/]admin[\\/]users[\\/]actions\.ts$/.test(f.file));
  assert.ok(actions, "app/admin/users/actions.ts is missing");
  assert.ok(!/await\s+requireUser\(\)/.test(actions.text) && /await\s+requireAdmin\(\)/.test(actions.text));
});

test("every Server Actions file calls requireUser or requireAdmin in each exported action", () => {
  const actions = files.filter((f) => /^\s*["']use server["']/.test(f.text));
  assert.ok(actions.length >= 8, "found too few action files; the search is broken");
  const bad = actions.filter((f) => {
    const exported = (f.text.match(/export\s+async\s+function/g) ?? []).length;
    const guarded = (f.text.match(/await\s+require(User|Admin)\(\)/g) ?? []).length;
    return guarded < exported;
  });
  assert.deepEqual(bad, [], `Actions missing a guard call: ${show(bad)}`);
});
