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

// A layout is not re-run when someone clicks between pages that share it, so each page must check for itself.
test("every dashboard page checks the user itself (or redirects, or hands off to a guarded component)", () => {
  const pages = files.filter((f) => /[\\/]\(app\)[\\/].*page\.tsx$/.test(f.file));
  assert.ok(pages.length >= 10, "found too few pages; the search is broken");
  const bad = pages.filter((f) => !/requireUser\(\)|redirect\(|SectorSales/.test(f.text));
  assert.deepEqual(bad, [], `Pages without a guard: ${show(bad)}`);
  const shared = readFileSync(join(APP_DIR, "..", "components", "SectorSales.tsx"), "utf8");
  assert.match(shared, /requireUser\(\)/, "SectorSales must guard itself");
});

test("every admin page goes through the shared Page wrapper, which checks the user", () => {
  const wrapper = readFileSync(join(APP_DIR, "..", "components", "admin", "Page.tsx"), "utf8");
  assert.match(wrapper, /requireAdmin\(\)/, "admin Page wrapper must require an admin");
  assert.doesNotMatch(wrapper, /requireUser\(\)/);
  const pages = files.filter((f) => /[\\/]admin[\\/].*page\.tsx$/.test(f.file));
  const bad = pages.filter((f) => !/<Page\b|redirect\(/.test(f.text));
  assert.deepEqual(bad, [], `Admin pages outside the Page wrapper: ${show(bad)}`);
});

test("layouts do not call the guard (it would block prerendering and is skipped on in-app navigation)", () => {
  const layouts = files.filter((f) => /layout\.tsx$/.test(f.file));
  const bad = layouts.filter((f) => /requireUser|requireAdmin|apiGuard/.test(f.text));
  assert.deepEqual(bad, [], `Layouts with a guard call: ${show(bad)}`);
});

test("every admin action requires an admin, not just a signed-in user", () => {
  const actions = files.filter((f) => /[\\/]admin[\\/]/.test(f.file) && /^\s*["']use server["']/.test(f.text));
  assert.ok(actions.some((f) => /[\\/]users[\\/]actions\.ts$/.test(f.file)), "app/admin/users/actions.ts is missing");
  const bad = actions.filter((f) => /await\s+requireUser\(\)/.test(f.text) || !/await\s+requireAdmin\(\)/.test(f.text));
  assert.deepEqual(bad, [], `Admin actions not admin-only: ${show(bad)}`);
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
