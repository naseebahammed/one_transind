import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import test from "node:test";

const ROOT_DIR = join(import.meta.dirname, "..");
const APP_DIR = join(ROOT_DIR, "app");

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

test("admin API route handlers require an admin via apiGuard(\"admin\")", () => {
  const adminRoutes = files.filter((f) => /[\\/]api[\\/](?:imports|companies)[\\/].*route\.ts$/.test(f.file));
  assert.equal(adminRoutes.length, 3, "expected imports, company template and company logo routes");
  const bad = adminRoutes.filter((f) => !f.text.includes('apiGuard("admin")'));
  assert.deepEqual(bad, [], `Admin route handlers not restricted to admin: ${show(bad)}`);
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
  const bad = pages.filter((f) => !/<Page\b|redirect\(/.test(f.text) || /export\s+default\s+async\s+function/.test(f.text));
  assert.deepEqual(bad, [], `Admin pages outside or awaiting before the Page wrapper: ${show(bad)}`);
});

test("layouts stay synchronous at top level and guard any Suspense data loaders", () => {
  const layouts = files.filter((f) => /layout\.tsx$/.test(f.file));
  const asyncLayouts = layouts.filter((f) => /export\s+default\s+async\s+function/.test(f.text));
  assert.deepEqual(asyncLayouts, [], `Async default layout blocks prerendering: ${show(asyncLayouts)}`);
  const adminLayout = layouts.find((f) => /[\\/]admin[\\/]layout\.tsx$/.test(f.file))!;
  assert.match(adminLayout.text, /await\s+requireAdmin\(\)/, "admin layout Sidebar must require an admin");
  assert.doesNotMatch(adminLayout.text, /requireUser\(\)/);
  const appLayout = layouts.find((f) => /[\\/]\(app\)[\\/]layout\.tsx$/.test(f.file))!;
  assert.match(appLayout.text, /await\s+requireUser\(\)/, "app layout Toolbar must require a signed-in user");
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

test("no inline use server functions exist outside signin and no-access without a guard", () => {
  const allUi = [...files, ...walkFiles(join(ROOT_DIR, "components")).map((file) => ({ file, text: readFileSync(file, "utf8") }))];
  const inline = allUi.filter((f) => !/^\s*["']use server["']/.test(f.text) && /["']use server["']/.test(f.text));
  const bad = inline.filter((f) => !/[\\/](?:signin|no-access)[\\/]page\.tsx$/.test(f.file) && !/await\s+require(User|Admin)\(\)/.test(f.text));
  assert.deepEqual(bad, [], `Unguarded inline Server Actions: ${show(bad)}`);
});

function hasDirective(text: string, directive: "use client" | "use server"): boolean {
  const body = text.replace(/^\uFEFF/, "").replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "").trimStart();
  return body.startsWith(`"${directive}"`) || body.startsWith(`'${directive}'`);
}

function resolveLocalModule(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(ROOT_DIR, specifier.slice(2))
    : specifier.startsWith(".")
      ? normalize(join(dirname(fromFile), specifier))
      : null;
  if (!base) return null;
  for (const suffix of ["", ".ts", ".tsx", join("", "index.ts"), join("", "index.tsx")]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

test("no NEXT_PUBLIC_ variables or next.config.ts env inlining expose secrets to the browser", () => {
  const codeFiles = [
    ...walkFiles(APP_DIR),
    ...walkFiles(join(ROOT_DIR, "components")),
    ...walkFiles(join(ROOT_DIR, "hooks")),
    ...walkFiles(join(ROOT_DIR, "lib")).filter((f) => !f.endsWith(".test.ts")),
    join(ROOT_DIR, "auth.ts"),
    join(ROOT_DIR, "proxy.ts"),
    join(ROOT_DIR, "next.config.ts"),
  ];
  const publicEnvHits = codeFiles.filter((f) => readFileSync(f, "utf8").includes("NEXT_PUBLIC_")).map((f) => relative(ROOT_DIR, f));
  assert.deepEqual(publicEnvHits, [], `NEXT_PUBLIC_ variables found in: ${publicEnvHits.join(", ")}`);

  const nextConfig = readFileSync(join(ROOT_DIR, "next.config.ts"), "utf8");
  assert.doesNotMatch(nextConfig, /\benv\s*:/, "next.config.ts must not inline server env vars via env: {}");
});

test("client components and their transitive non-action imports never read process.env or server-only modules", () => {
  const roots = [
    ...walkFiles(APP_DIR),
    ...walkFiles(join(ROOT_DIR, "components")),
    ...walkFiles(join(ROOT_DIR, "hooks")),
    ...walkFiles(join(ROOT_DIR, "lib")).filter((f) => !f.endsWith(".test.ts")),
  ].filter((f) => hasDirective(readFileSync(f, "utf8"), "use client"));
  assert.ok(roots.length >= 25, "found too few client files; the search is broken");

  const serverOnlyFiles = new Set(
    ["auth.ts", "lib/pg.ts", "lib/db.ts", "lib/server-config.ts", "lib/ask-ai.ts", "lib/guard.ts"].map((p) => normalize(join(ROOT_DIR, p))),
  );
  const visited = new Set<string>(roots);
  const queue = [...roots];
  const violations: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const text = readFileSync(current, "utf8");
    if (hasDirective(text, "use server")) continue; // Server Actions compile to RPC stubs on the client

    const relCurrent = relative(ROOT_DIR, current);
    if (serverOnlyFiles.has(normalize(current))) {
      violations.push(`${relCurrent} is server-only`);
    }
    if (/\bprocess\.env\b/.test(text)) {
      violations.push(`${relCurrent} accesses process.env`);
    }

    const importPattern = /\b(?:import|export)\s+(?!type\b)(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[1];
      if (specifier === "pg" || specifier === "crypto" || specifier === "node:crypto") {
        violations.push(`${relCurrent} imports server package ${specifier}`);
      }
      const target = resolveLocalModule(current, specifier);
      if (target && !visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }
  assert.deepEqual(violations, [], `Client boundary violations: ${violations.join("; ")}`);
});

test("secret environment variables are read only inside lib/server-config.ts", () => {
  const secretVarPattern = /\bprocess\.env\.(?:PGPASSWORD|OPENAI_API_KEY|AUTH_SECRET|AUTH_MICROSOFT_ENTRA_ID_SECRET|ADMIN_LOGIN_HASH)\b/;
  const allowed = normalize(join(ROOT_DIR, "lib", "server-config.ts"));
  const appAndLibFiles = [
    ...walkFiles(APP_DIR),
    ...walkFiles(join(ROOT_DIR, "components")),
    ...walkFiles(join(ROOT_DIR, "hooks")),
    ...walkFiles(join(ROOT_DIR, "lib")).filter((f) => !f.endsWith(".test.ts")),
    join(ROOT_DIR, "auth.ts"),
    join(ROOT_DIR, "proxy.ts"),
  ];
  const offenders = appAndLibFiles
    .filter((f) => normalize(f) !== allowed && secretVarPattern.test(readFileSync(f, "utf8")))
    .map((f) => relative(ROOT_DIR, f));
  assert.deepEqual(offenders, [], `Direct secret process.env reads outside lib/server-config.ts: ${offenders.join(", ")}`);
});
