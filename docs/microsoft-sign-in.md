# Microsoft sign-in setup

Only people on the approved list who sign in with a Transind Microsoft 365 account can open One Transind.

## 1. Register the app in Microsoft Entra (your Microsoft 365 admin)

Entra admin center → App registrations → New registration.

- Supported account types: this organization only (single tenant).
- Web redirect URIs (add both):
  - `http://localhost:3000/api/auth/callback/microsoft-entra-id`
  - `https://one.transindgroup.com/api/auth/callback/microsoft-entra-id`
- Certificates & secrets → New client secret. Copy the value straight away; it is shown once.
- Note the Directory (tenant) ID and Application (client) ID.

The live site must be served over `https`. Microsoft only allows plain `http` for `localhost`.

## 2. Settings (`.env.local` locally, the server's environment when live)

Never commit these or paste them into chat.

| Setting | Value |
| --- | --- |
| `AUTH_SECRET` | a long random string (for example `npx auth secret`) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Application (client) ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | the client secret value |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<tenant id>/v2.0` |
| `ADMIN_EMAILS` | `naseeb@transindgroup.com,mohammed@transindgroup.com` |
| `AUTH_URL` | `http://localhost:3000` locally, `https://one.transindgroup.com` live |

`ADMIN_EMAILS` people are always allowed in and are the only ones who can open the Users page. Everyone else must be added there.

## 3. Create the users table (once)

Migration `021_app_users` adds `app.users`. It has not been applied anywhere yet.

Careful: `npm run dev` applies every pending migration by itself the first time the app touches the database (see `autoInit` in `lib/db.ts`). `.env.local` points at the live database, so do not run `npm run dev` or `npm run build` until `.env.local` points at a safe copy, unless you want 021 created on live. In production, 021 is applied by starting once with `DB_INIT=true`.

Until the table exists, only `ADMIN_EMAILS` people can sign in.

## 4. Check it works

1. Sign in as an admin, open Admin → Users, add a colleague.
2. Sign in as that colleague: they reach the dashboard but not anything under Admin (they see "No access").
3. Remove them: their next page load shows "No access".
4. Sign in with a Transind account that is not on the list: "No access".
5. Open `/api/ask` without signing in: 401.

## Testing before the Microsoft values arrive

Set `AUTH_DEV_LOGIN=true` in `.env.local` and run `npm run dev`. The sign-in page then shows a "Test sign in" box: type an email that is in `ADMIN_EMAILS` or on the Users list. It is still checked against the approved list. The box does not exist in production builds, whatever the setting. You still need `AUTH_SECRET` set. Remove the setting once real Microsoft sign-in works.
