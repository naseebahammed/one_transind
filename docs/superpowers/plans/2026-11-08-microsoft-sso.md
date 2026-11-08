# Microsoft SSO Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only approved people with a Transind Microsoft 365 account can open One Transind; two admins manage the approved list in the app.

**Architecture:** Auth.js (`next-auth`) signs people in against the Transind Entra tenant and keeps a JWT session cookie. A small pure module decides who is allowed (env admins + a new `app.users` table). `proxy.ts` blocks unsigned-in requests early; one server helper (`requireUser` / `requireAdmin`) re-checks the table on every page, route handler and Server Action.

**Tech Stack:** Next.js 16.4.3 (App Router, `proxy.ts`), React 19, TypeScript, PostgreSQL via `lib/db.ts`, `node --test`, new dependency `next-auth` (Auth.js v5, owner approved).

**Spec:** `docs/superpowers/specs/2026-11-08-microsoft-sso-design.md`

## Global Constraints

- Branch: create `feat/microsoft-sso` from the current branch; never push to master.
- Migrations: append to `MIGRATIONS` in `lib/schema.ts`; never edit a shipped one. Deliver unapplied: do NOT run it (`.env.local` is the live database). `DB_INIT=true` applies it when the owner chooses.
- No `$` character as a symbol or identifier; currency text is `QAR`.
- No secrets in code or git. New env vars: `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`, `ADMIN_EMAILS` (comma separated).
- Files under `app/` must not import `q`, `q1`, `numbering` or `pg` from `@/lib/db` / `@/lib/pg` (an existing test enforces it); SQL lives in `lib/`.
- Files `kebab-case.ts`, full-word names, SQL snake_case, TS camelCase. Follow the admin Accounts page pattern.
- Next.js 16 has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` (proxy, authentication) before writing Task 3 and 4 code.
- Identity is the lowercase UPN (`preferred_username`), tenant `tid` must equal the configured tenant. Admin comes only from `ADMIN_EMAILS`; the table holds regular users only (so `app.users` has no `is_admin` column; this settles the spec's earlier mention).
- Every page and API route requires login; unsigned-in `/api/*` gets 401, pages redirect to `/signin`. No exceptions.

## Review Focus

- Email written with capitals or spaces (`" Aisha@Transind.com "`) must still match the list. Pinned in Task 1.
- Empty or unset `ADMIN_EMAILS` means nobody is admin (fail closed), not everybody. Pinned in Task 1.
- A person removed from the list while holding a valid cookie is refused on their next request. Pinned in Task 3 (`requireUser` re-checks the table).
- Database down or table not yet migrated: env admins still get in, everyone else is refused, no crash. Pinned in Task 3.
- A signed-in Microsoft user from another tenant is refused even with a listed email. Pinned in Task 1 (`inTenant`).
- Any new route handler or Server Action added later without a guard fails the test suite. Pinned in Task 5.

---

### Task 1: Access rules (pure)

**Files:**
- Create: `lib/access.ts`
- Test: `lib/access.test.ts`

**Interfaces:**
- Produces:
  - `normalizeEmail(email: string): string` (trim, lowercase)
  - `parseAdminEmails(value: string | undefined): string[]` (split on commas, normalize, drop empties)
  - `roleOf(email: string, adminEmails: readonly string[], listedEmails: ReadonlySet<string>): "admin" | "user" | null`
  - `inTenant(tokenTenantId: string | undefined, issuer: string | undefined): boolean` (true only when the issuer URL contains the token's tenant ID as a path segment, e.g. `https://login.microsoftonline.com/<tid>/v2.0`; false if either is missing)

- [ ] **Step 1: Write failing tests** in `lib/access.test.ts` (`node:test` + `assert`, like the other `lib/*.test.ts`):
  - `inTenant("abc", "https://login.microsoftonline.com/abc/v2.0")` is true; `inTenant("xyz", sameIssuer)`, `inTenant(undefined, sameIssuer)` and `inTenant("abc", undefined)` are false.
  - `parseAdminEmails(" A@x.com, b@X.com ,,")` equals `["a@x.com", "b@x.com"]`; `parseAdminEmails(undefined)` and `("")` equal `[]`.
  - `roleOf(" A@X.com ", ["a@x.com"], new Set())` is `"admin"`.
  - `roleOf("c@x.com", ["a@x.com"], new Set(["c@x.com"]))` is `"user"`; `roleOf("D@x.com", [], new Set(["c@x.com"]))` is `null`.
  - With `adminEmails = []` nobody is admin and an unlisted email is `null`.
- [ ] **Step 2: Run** `npm test` and confirm the new tests fail (module missing).
- [ ] **Step 3: Implement** the three functions in `lib/access.ts`. `roleOf` normalizes the email first; admin wins over user.
- [ ] **Step 4: Run** `npm test`; all tests pass.
- [ ] **Step 5: Commit** `feat: add access rules for sign-in`.

### Task 2: Users table and list helpers

**Files:**
- Modify: `lib/schema.ts` (new `APP_USERS` SQL constant above `MIGRATIONS`; append `["021_app_users", APP_USERS]`)
- Create: `lib/users.ts`

**Interfaces:**
- Consumes: `q`, `q1` from `@/lib/db`; `normalizeEmail` from `@/lib/access`.
- Produces:
  - `type AppUser = { email: string; created: string }`
  - `listUsers(): Promise<AppUser[]>` (ordered by email)
  - `listedEmails(): Promise<Set<string>>`
  - `addUser(email: string): Promise<{ error?: string }>` (rejects empty or not containing `@`, and duplicates, with a plain message)
  - `removeUser(email: string): Promise<void>`

- [ ] **Step 1:** Add migration SQL: `CREATE TABLE app.users(email TEXT PRIMARY KEY CHECK (email = lower(btrim(email))), created TIMESTAMPTZ NOT NULL DEFAULT now());`. Append it as `021_app_users`. Do not run it.
- [ ] **Step 2: Implement** `lib/users.ts` with the signatures above; `created` selected `AS created` cast to text. `addUser` uses `INSERT ... ON CONFLICT DO NOTHING` and reports "That person is already on the list." when no row was inserted.
- [ ] **Step 3: Run** `npm test`; existing tests (including `sql-aliases.test.ts`) still pass.
- [ ] **Step 4: Commit** `feat: add app.users migration and list helpers` (state in the message that the migration is not applied).

### Task 3: Auth.js sign-in and the guard helper

**Files:**
- Modify: `package.json`, `package-lock.json` (add `next-auth` at the v5 release that supports Next 16; confirm against the installed docs)
- Create: `auth.ts` (repo root), `app/api/auth/[...nextauth]/route.ts`, `lib/guard.ts`
- Test: `lib/guard.test.ts`

**Interfaces:**
- Consumes: `parseAdminEmails`, `roleOf` (Task 1); `listedEmails` (Task 2).
- Produces:
  - `auth.ts` exports `{ handlers, auth, signIn, signOut }` (Auth.js standard). Provider: Microsoft Entra ID. Callback `signIn` refuses when `inTenant(profile.tid, process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER)` is false, or when `roleOf(...)` is null. Session carries the lowercase UPN as `session.user.email`. Pages: `signIn: "/signin"`, `error: "/no-access"`.
  - `lib/guard.ts`:
    - `currentRole(email: string | null | undefined, listLoader?: () => Promise<Set<string>>): Promise<"admin" | "user" | null>`: reads `ADMIN_EMAILS`, loads the table (default `listedEmails`), returns the role; if the loader throws, treat the list as empty (env admins still pass).
    - `requireUser(): Promise<{ email: string; role: "admin" | "user" }>` and `requireAdmin()`: call `auth()` then `currentRole`; unauthenticated or null role redirects to `/signin` or `/no-access` (use `redirect` from `next/navigation`); `requireAdmin` sends a non-admin to `/no-access`.
    - `apiGuard(): Promise<Response | null>`: returns a 401 JSON `Response` when there is no valid, listed person, else `null`. Route handlers call it first.

- [ ] **Step 1: Write failing tests** in `lib/guard.test.ts` for `currentRole` only (it takes an injected loader so no database is needed):
  - listed email gives `"user"`; env admin gives `"admin"`; unlisted gives `null`; `null`/`undefined` email gives `null`.
  - Loader that throws: env admin still `"admin"`, a listed-in-table person gives `null`.
  - Set `process.env.ADMIN_EMAILS` inside each test and restore it after.
- [ ] **Step 2: Run** `npm test`; confirm failure.
- [ ] **Step 3: Install** `next-auth`; implement `lib/guard.ts` and `auth.ts`; add the route file re-exporting `handlers.GET` / `handlers.POST`.
- [ ] **Step 4: Run** `npm test`; all pass. Run `npx tsc --noEmit`; no type errors.
- [ ] **Step 5: Commit** `feat: add Microsoft sign-in and access guard`.

### Task 4: Sign-in screens and proxy

**Files:**
- Create: `app/signin/page.tsx`, `app/no-access/page.tsx`, `proxy.ts` (repo root)

**Interfaces:**
- Consumes: `signIn`, `signOut`, `auth` from `auth.ts`.
- Produces: `proxy.ts` default-exports the Auth.js `auth` wrapper (or a function) that, for any request without a valid session cookie, returns 401 JSON for paths starting `/api/` and a redirect to `/signin` otherwise. Matcher excludes `/api/auth/*`, `_next/*`, `/signin`, `/no-access`, `favicon.ico`, and the static public assets (`logo.webp` etc.). The proxy checks the cookie only; it never queries the database.

- [ ] **Step 1: Implement** `/signin` (one "Sign in with Microsoft" button posting a Server Action that calls `signIn("microsoft-entra-id", { redirectTo: "/" })`; redirectTo is fixed to `/`, never taken from the URL) and `/no-access` (plain message "Your account is not approved for One Transind. Ask an administrator." plus a sign-out button). Use the app's existing styling classes; no new components.
- [ ] **Step 2: Implement** `proxy.ts` per the interface. Check Next 16's proxy docs for the exact export shape.
- [ ] **Step 3: Verify** with `npm run dev` and no cookie: `curl -i http://localhost:3000/dashboard` returns a redirect to `/signin`; `curl -i http://localhost:3000/api/ask` returns 401. (Requires the env vars; use placeholder values for this check, no live sign-in yet.)
- [ ] **Step 4: Commit** `feat: add sign-in pages and proxy`.

### Task 5: Guard every page, route handler and action

**Files:**
- Modify: `app/(app)/layout.tsx`, `app/admin/layout.tsx` (call `requireUser()` first); every `route.ts` under `app/api/` (`ask`, `imports/[id]`, `companies/[id]/logo`, `companies/[id]/template`) call `apiGuard()` first and return it if non-null; every `"use server"` file under `app/` (find with `grep -rl '"use server"' app`) call `requireUser()` at the top of each exported action.
- Test: `lib/guard-coverage.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `apiGuard` from `@/lib/guard`.

- [ ] **Step 1: Write the failing test** (same style as the walk-the-files test in `lib/sql-aliases.test.ts`): every `route.ts` under `app/api/` except `app/api/auth/` contains `apiGuard`; every file under `app/` whose text starts with `"use server"` contains `requireUser` or `requireAdmin`. Assertion message lists offenders.
- [ ] **Step 2: Run** `npm test`; confirm it fails listing the unguarded files.
- [ ] **Step 3: Add the guards** as listed above. Keep each edit to the guard call; touch nothing else in these files.
- [ ] **Step 4: Run** `npm test` and `npm run build`; both pass.
- [ ] **Step 5: Commit** `feat: require sign-in on all pages, routes and actions`.

### Task 6: Users admin page

**Files:**
- Create: `app/admin/users/page.tsx`, `app/admin/users/actions.ts`, `components/admin/AddUserForm.tsx`
- Modify: `components/admin/AdminSidebar.tsx` (add `{ href: "/admin/users", title: "Users", icon: Users }` to the "System" group; import `Users` from lucide-react)

**Interfaces:**
- Consumes: `requireAdmin` (Task 3), `listUsers`, `addUser`, `removeUser` (Task 2), `parseAdminEmails` (Task 1), `Page`, `Table`, `Button`, `Input`, `ConfirmButton` admin components.
- Produces: server actions `addUserAction(_: UserState, f: FormData): Promise<UserState>` and `removeUserAction(f: FormData): Promise<void>` (`type UserState = { error?: string }`), both calling `requireAdmin()` first and `revalidatePath("/", "layout")` after.

- [ ] **Step 1: Implement** the page: title "Users", a table of env admins (read-only, marked "Admin") followed by listed users with a remove button using `ConfirmButton`, and `AddUserForm` modelled on `AddAccountForm`. A non-admin who opens the page is redirected by `requireAdmin()`. Hide the sidebar link from non-admins is out of scope (the page itself refuses them).
- [ ] **Step 2: Extend** `lib/guard-coverage.test.ts` expectation: `app/admin/users/actions.ts` must contain `requireAdmin`.
- [ ] **Step 3: Run** `npm test` and `npm run build`; both pass.
- [ ] **Step 4: Commit** `feat: add admin page to manage approved users`.

### Task 7: Setup notes and end-to-end check

**Files:**
- Create: `docs/microsoft-sign-in.md`

- [ ] **Step 1: Write** the setup note: Entra app registration (single tenant; redirect URIs `http://localhost:3000/api/auth/callback/microsoft-entra-id` and `https://one.transindgroup.com/api/auth/callback/microsoft-entra-id`), the five env vars with where each value comes from, `AUTH_URL` per environment, the requirement that the live site is served over https, and the one-time step to apply migration `021_app_users` (`DB_INIT=true`, owner decides when).
- [ ] **Step 2: Verify locally** once the owner supplies the Entra values and applies the migration to a safe database: an approved account reaches `/`; an unlisted account lands on `/no-access`; removing a person on the Users page locks their next request; `ADMIN_EMAILS` accounts still get in with the table unavailable.
- [ ] **Step 3: Commit** `docs: add Microsoft sign-in setup notes`.
