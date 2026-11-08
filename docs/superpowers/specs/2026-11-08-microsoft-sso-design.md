# Microsoft SSO sign-in: design

## Intent
One Transind has no sign-in today. Anyone who reaches the server sees group financials. Add Microsoft 365 sign-in so only selected Transind staff get in.

## Goals
- Sign in with a Transind Microsoft 365 account (single tenant).
- Only people on an approved list may enter, even if they have a valid Transind account.
- Two admins manage the approved list from inside the app. Everyone else on the list can use the app but cannot manage the list.
- All pages and API routes require sign-in, including `/admin`, `/api/ask`, and the logo/template/import downloads.

## Non-goals
- Outside/guest users, password logins, other identity providers.
- Per-page or per-company permissions. There are only two kinds of people: admin and user.
- Managing access through Microsoft groups.

## Anti-goals (a failure even if it "works")
- A valid Transind account that is not on the list gets in.
- The two admins are locked out, or the list can only be fixed by editing the database by hand.
- Secrets (tenant ID, client ID, client secret, session secret) appear in code or git.

## Decisions by the owner
- Approved list is managed in the app, not in a Microsoft group.
- Exactly two admins manage the list.
- Add Auth.js (`next-auth`) as the sign-in library (owner approved the new dependency).

## Calls made by me (please check)
- Table `app.users` (new migration appended to `MIGRATIONS` in `lib/schema.ts`; never edit shipped ones): `email` (lowercase, unique), `is_admin boolean`, `created`. Not `app.accounts`: that table is the chart of accounts.
- Bootstrap: `ADMIN_EMAILS` in `.env.local` (comma separated). Those emails are always admins and always allowed, regardless of the table, so the owner can never be locked out. Table rows can add further regular users; admin-ness of the two comes from the env var.
- Match on the verified email/UPN from the Microsoft token, compared lowercase. Reject tokens from any tenant other than the configured one.
- Session: Auth.js JWT session cookie (no session table). Removing a person from the list must take effect on their next request, so the allowed check runs against the table on each request, not only at sign-in.
- Protection: Next.js 16 uses `proxy.ts` (the new name for middleware) to redirect unsigned-in users to sign-in; admin pages and the list-management actions also re-check admin on the server.
- Unlisted user sees a plain "no access" page with a sign-out link.
- Admin UI: a new "Users" page under `app/admin/` using the existing admin components (table, form, confirm button), following the pattern of the existing admin Accounts page.

## More calls made by me, after the builder check
- Admin status comes only from `ADMIN_EMAILS` (max two by convention). The Users page lists them as read-only "Admin"; the table holds regular users only, and there is no promote/demote in the UI. Removing an env admin from the page does nothing.
- Identity: match the lowercase UPN (`preferred_username`) from the token, not the mutable `email` claim; the tenant ID (`tid`) must equal the configured tenant. The approved list therefore holds each person's Microsoft sign-in address.
- Guard: `proxy.ts` only checks the session cookie and redirects (pages) or returns 401 (`/api/*`). Excluded: `/api/auth/*`, `_next`, favicon, the no-access page. Every page, route handler and Server Action also calls one server helper that checks the table (and admin where needed), because the proxy alone does not cover them.
- Migration is delivered unapplied; the owner chooses when to run it (`DB_INIT=true`). If the table is missing or the database is down, `ADMIN_EMAILS` people can still sign in; everyone else is refused.
- No audit-log entry for list changes (the log table has no actor column; adding one is a separate schema change).

## Site address (owner answer)
- Today: local, `http://localhost:3000` (Microsoft allows http for localhost).
- Going live at `one.transindgroup.com`. My assumption: served over `https`. The Entra app registration needs both redirect URIs: `http://localhost:3000/api/auth/callback/microsoft-entra-id` and `https://one.transindgroup.com/api/auth/callback/microsoft-entra-id`. `AUTH_URL` is set per environment. If the live site is not https, sign-in will not work and the owner must fix that first.
- Owner decision: no access without login, and no exceptions for scripts or other systems. Every page and API route requires a signed-in, approved person.

## Constraints
- Next.js 16, React 19, App Router; `npm test` must pass; add a small unit test for the pure "is this email allowed / admin" function in `lib/`.
- Use QAR/naming/style rules in CLAUDE.md. No `$` as an identifier.
- Do not touch production data. `.env.local` points at the live database: the migration must not run until the owner agrees.
- Work on a branch; do not push to main.

## Owner must provide (prerequisite, outside the code)
Someone with Entra ID admin rights registers the app: redirect URI `<site url>/api/auth/callback/microsoft-entra-id`, single tenant, and gives: tenant ID, client ID, client secret. Plus the final site URL (the app runs on an internal Windows server / Docker).

New env vars: `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` (tenant issuer URL), `ADMIN_EMAILS`.

## Left to the builder
Exact Auth.js version/config for Next 16, file names, page styling, and the wording of messages.
