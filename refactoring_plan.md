# One Transind — Refactoring Plan

_2026-11-07. Follows `architecture_review.md` and the code-smell review. Smell 5 (duplicated month lists, `sum`, number formatters) is already fixed in the working copy, not yet committed._

**Goal:** consistent naming, concerns kept separate, smaller modules. **The business logic does not change:** every page shows the same numbers, every upload accepts and rejects the same files, and the database schema stays the same.

**Order:** lowest risk and highest payoff first. Each step stands on its own. Stop after any step and the app is still in a good state.

---

## Ground rules for every step

1. **One step = one branch = one review.** Branch from `feature/company-five-sections` (or `master` once that is merged). Never push to `master`.
2. **Tell the other developer before each step.** Steps 3–7 touch files they may have open. Agree who owns which files that week.
3. **Move code first, improve it in a later change.** When code is moved, it is copied exactly. Renames and cleanups come in a separate commit, so the reviewer can see that nothing else changed.
4. **Every step passes three checks before review:**
   - `npm test`: all tests pass.
   - `npx tsc --noEmit`: no type errors. This is what catches a missed rename or import.
   - **Same numbers on screen:** before and after, open the pages the step touches and compare the totals. Do this against a **copy of the database**, never the live one: `.env.local` points at production, and starting the app in development runs migrations.
5. **No new libraries. No schema changes.** If a step seems to need either, stop and ask.

---

## Step 0 — Safety net (risk: none · impact: makes every later step safe)

**What**
- Commit the smell-5 fix and `architecture_review.md`.
- Add tests that pin down today's results for the calculations that later steps move:
  - `report()`, `occupancy()`, `revenueLines()` in `lib/al-manzil.ts`, on a small fixed data set.
  - `reportsFor` / `salesFor` from `app/admin/finance/page.tsx`, once Step 5 extracts them. Until then, write down the totals from one known company and year.
- Set up a database copy for checking pages (a staging database, or a restored backup with its own `.env.local`).

**Why first:** these tests describe the current behaviour, whatever it is. If a later step changes a number, a test fails instead of a finance user noticing.

**Done when:** the new tests pass on today's code, and the dev server runs against the copy.

---

## Step 1 — One place for sector keys and the Al Manzil lookup (risk: very low · impact: high)

**Smell:** hard-coded values (#2).

**What**
- In `lib/org.ts`, next to `SECTORS`, add named constants for the keys the code depends on, for example:
  ```ts
  export const SECTOR = { realEstate: "re", healthBeauty: "hb", retail: "retail", fmcg: "fmcg" } as const;
  ```
- Replace the ~12 literal keys with these constants (`"re"`, `"hb"`, `"retail"`, `"fmcg"`). They are in `dashboard/page.tsx`, `real-estate/*/page.tsx`, `retail/page.tsx`, `health-beauty/page.tsx`, `hr/page.tsx`, `admin/data-status/page.tsx` and `admin/al-manzil/actions.ts`.
- Remove the dashboard's own copy of sector names (`FILE_SECTORS` in `dashboard/page.tsx`) and take the names from `SECTORS`.
- Move the Al Manzil name pattern (`'al manzil%'`) into one named constant in `lib/al-manzil.ts`. The lookup stays the same; only the hidden assumption gets a name.

**Why:** today, finding everything that depends on "real estate" means searching for a two-letter string. Afterwards, the editor's "find all references" lists every use, and `PROTECTED_SECTOR_KEYS` visibly protects exactly those constants.

**Not changing:** sector keys in the database, the Al Manzil lookup itself (replacing it with a company picker changes behaviour, so it's a separate decision).

**Size:** about 8 files, one commit. Pure substitution, so the type check catches mistakes.

---

## Step 2 — Agree naming conventions, then rename the worst names (risk: low · impact: high for readability)

**Smell:** cryptic names (#4).

**What**
1. Add a short **Naming** section to `CLAUDE.md` / `AGENTS.md`, so both developers (and Claude) follow it:
   - Exported functions and types use full words: `lastMonth`, not `lm`.
   - Short names are fine only inside a 1–3 line lambda (`(r) => r.value`).
   - Files are `kebab-case.ts` and named after what they contain, not after one company.
   - SQL keeps `snake_case`; TypeScript uses `camelCase`. Fields map between them in one place, the query that reads them.
2. Rename, using the editor's **Rename symbol** (not find/replace), one area per commit:
   - **Data shapes in `lib/data.ts`:** `Item`, `Brand`, `Cust`, `Row`, `DrillRow` fields: `v → value`, `lm → lastMonth`, `lv → lastMonthValue`, `ly → lastYear`, `ly2 → twoYearsAgo`, `c → cost`, `u → units`, `cr → creditNotes`, `n → name`, `k → key`. Change the SQL `AS` aliases at the same time, so the row type still matches.
   - **Local names in big pages:** `admin/finance/page.tsx` (`rs`, `sy`, `uy`, `yr`), `dashboard/page.tsx` (`amSum`, `reCos`).
   - **Leave the DB helpers `q`, `q1` and `numbering` alone for now.** They're used everywhere and are well commented, so renaming them is a lot of churn for little gain. Revisit after Step 4.

**Why:** names are the cheapest documentation. `ly2` needs someone to explain it; `twoYearsAgo` doesn't.

**Risk notes:** many files change, but the type check catches every missed reference. The real risk is merge conflicts with the other developer, so agree on a quiet day and land each rename area quickly.

---

## Step 3 — Split `lib/al-manzil.ts` by job (risk: low · impact: high)

**Smell:** one file doing four jobs (#1, part 1).

**What:** move code without changing it, into:

| New file | Gets | Today in `al-manzil.ts` |
| --- | --- | --- |
| `lib/report-parsers.ts` | Reading uploaded workbooks | `num`, `cellDate`, sheet title month, `pnlFromWorkbook`, `matchAccounts`, `dailyFromWorkbook`, `checkDaily`, `unitsFromWorkbook` and their types |
| `lib/reports.ts` | Loading figures and the calculations | `loadReports`, `keyFor`, `alManzilKey`, `years`, `report`, `revenueLines`, `occupancy`, `dailyYears`, `plRows` |

Order of commits:
1. Create the two files by moving code. Keep `lib/al-manzil.ts` as a temporary re-export (`export * from "./report-parsers.ts"; export * from "./reports.ts";`), so none of the 14 importing files change yet.
2. Point each importer at the right new file. Parsers are used by admin actions and tests; readers by pages, `SectorSales` and `/api/ask`.
3. Delete `lib/al-manzil.ts`. Rename `al-manzil.test.ts` to match.

**Why:** a change to how uploads are read can no longer touch the occupancy maths, and the parsers stay testable without a database. The file names also say what's inside.

**Done when:** the importer count for `al-manzil` is 0, and Step 0's tests pass unchanged.

---

## Step 4 — Move SQL out of server actions and API routes (risk: medium · impact: high)

**Smell:** data access mixed into the request layer (#3).

**What:** raw SQL lives in 8 files under `app/`. Move each query into the `lib/` file that already owns that table, then call it from the action or route:

| From | To |
| --- | --- |
| `app/admin/sectors/actions.ts` | `lib/sectors.ts`: `findSectorByName`, `createSector` (key building included), `renameSector`, `deleteSector` |
| `app/admin/company-types/actions.ts` | `lib/property-types.ts` |
| `app/admin/accounts/actions.ts` | `lib/accounts.ts` |
| `app/admin/sales-sectors/actions.ts` | `lib/sales-sectors.ts` |
| `app/admin/companies/actions.ts` | `lib/companies.ts`: `saveCompany`, `setCompanyHidden` |
| `app/api/deals/route.ts`, `app/api/deals/[id]/route.ts` | `lib/deals.ts` (new): `createDeal`, `moveDealStage`, moving `getDeal`, `listDeals`, `toDeal` out of `lib/db.ts` |
| `app/api/imports/[id]/route.ts` | `lib/company-figures.ts`: `getImportFile` |

The target shape for every server action:
```ts
export async function addSector(_: SectorState, f: FormData): Promise<SectorState> {
  const name = readName(f);                 // 1. read and check the input
  if (!name) return { error: "Name is required." };
  const result = await createSector(name);  // 2. one lib call does the work
  if ("error" in result) return result;
  revalidatePath("/admin", "layout");       // 3. refresh the page cache
  return {};
}
```

**Why:** each table is then queried from one place, so a column rename is a one-file change. The logic that moved into `lib/` can get tests, and the action is short enough to check at a glance.

**Do it:** one actions file per commit. Copy the SQL exactly, and keep every error message and check (the "max + 1" numbering lock, `FOR UPDATE`, duplicate-name checks) as it is.

**Risk notes:** this is the first step that moves code that writes to the database. Test each admin form by hand on the database copy: add, rename and delete a sector; save a company; create a deal and move it to won.

---

## Step 5 — Thin the big pages (risk: medium · impact: medium)

**Smell:** oversized pages that mix calculation and layout (#4).

**What**
- `app/admin/finance/page.tsx` (241 lines): move `reportsFor`, `salesFor`, the per-year totals (`byYear`) and the expense rows into `lib/finance-summary.ts`. The page keeps only the layout. Add the Step 0 tests for these functions here.
- Do the same for `app/(app)/dashboard/page.tsx` (the real-estate and sector totals) and `app/(app)/real-estate/overview/page.tsx` (173 lines).
- Small presentational pieces used only once (like `HideToggle`) can stay in the page file. Split a component out only when it's reused or the page is still over ~150 lines.

**Why:** calculations in `lib/` can be tested; calculations in a page cannot. A page that is only layout is also easy to restyle without risk to the numbers.

---

## Step 6 — Replace the shared report snapshot (risk: medium–high · impact: medium now, high as data grows)

**Smell:** hidden ordering rule and shared server state (#1, part 2).

**What:** today `loadReports()` fills one module-level `snap`, and the readers throw if it wasn't called first. Change this so the snapshot is a value that gets passed around:
```ts
// lib/reports.ts
export const loadReports = cache(async () => { /* same queries */ return snapshot; }); // React cache: once per request
export function report(snapshot: Reports, year: number, key: Key) { ... }
```
- The 9 callers (`dashboard`, `finance`, both `real-estate` pages, `admin/companies/[id]`, `admin/data-status`, `admin/finance`, `SectorSales`, `/api/ask`) change from `await loadReports(); report(y, k)` to `const reports = await loadReports(); report(reports, y, k)`.
- The type check then guarantees no reader runs without loaded data. The error "loadReports() must be awaited" can be deleted.

**Why:** there's no shared state between requests and no ordering rule to remember. Several components on one page share one load instead of each reloading everything.

**Why it's late:** it touches every report page at once, and changes *when* data is loaded (per request instead of last-writer-wins). The numbers must not change, so Step 0's tests and a side-by-side page check matter most here.

**Not in this step:** loading only the companies a page needs. That's a performance change. Do it later, once this is in.

---

## Step 7 — Retire the legacy dashboard: already done (checked 2026-11-07)

`app/legacy/`, `public/app.js`, `public/td.js`, `/api/bootstrap` and `/api/deals*` no longer exist in the code, so the deals pipeline page is gone too. Left over:
- `/api/sales`, `/api/customers`, `/api/invoices`: not checked whether anything still calls them. Search for each path before deleting.
- Tables `app.deals`, `app.invoices`: kept. Dropping them is a schema change and needs its own approval.
- Step 4 below still lists the deals routes and `lib/deals.ts`; skip those rows.

---

## Deliberately not in this plan

| Item | Why it's left out |
| --- | --- |
| Adding login / access control | The biggest risk in the app, but it **changes behaviour**. Plan it separately, and soon. |
| A company picker instead of the Al Manzil name lookup | Behaviour change (Step 1 only names the lookup). |
| One UI system (business CSS vs. Tailwind + Radix) | Big, visual and no business benefit right now. Rule instead: new admin screens use Tailwind + Radix, business pages keep their CSS. |
| Renaming `q` / `q1` / `numbering` | Lots of churn, little gain. Revisit after Step 4. |
| Faster report loading, a bigger connection pool | Performance work. Measure after Step 6. |

---

## Summary

| Step | Change | Risk | Impact | Rough size |
| --- | --- | --- | --- | --- |
| 0 | Commit + baseline tests + database copy | None | Enables the rest | ½ day |
| 1 | Named sector keys and Al Manzil constant | Very low | High | 1–2 h |
| 2 | Naming conventions + rename data shapes | Low | High | 1 day |
| 3 | Split `al-manzil.ts` into parsers / reports | Low | High | ½ day |
| 4 | SQL out of actions and routes into `lib/` | Medium | High | 1–2 days |
| 5 | Calculations out of big pages | Medium | Medium | 1 day |
| 6 | Snapshot passed as a value, per-request cache | Medium–high | Medium → high | 1 day |
| 7 | Retire legacy dashboard | Done | - | Only leftover API routes and tables to review |
