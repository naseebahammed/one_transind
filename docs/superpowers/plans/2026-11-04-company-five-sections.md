# Five-Section Company Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin company page into five sections (Profile, P&L, Balance sheet and cash, Budget, People), each with a downloadable Excel template, a validated upload and a monthly submission status.

**Architecture:** `/admin/companies/[id]?section=…&year=…` shows one section at a time. P&L keeps its existing CSV storage and uploader, because the live reports read those files. The three new sections share one fixed-line Excel layout, one pure validator and one new database table.

**Tech Stack:** Next.js 16.4 server actions and route handlers, React 19, Postgres (`pg`), ExcelJS, `node --test`.

**Spec:** None. The user chose to skip design questions, so the decisions below are the spec.

## Decisions

From the user:
- Five sections on the company page: profile, P&L, balance sheet and cash, budget, people.
- The admin requests data and uploads it.
- Login is out of scope during development.

Assistant's calls, for the user to check:
- "Requesting data" means downloading a template to send to the company. Nothing is emailed.
- P&L stays in the CSV files. New sections use the database.
- Status is derived from what is on file: **Submitted**, **Not submitted** or **Not due**. There is no approval step yet.
- Existing reports do not read the new data yet.

**Not in this plan:** login, approval, email reminders, the all-companies tracker, sector add-ons, changes to public report pages, and moving P&L out of CSV.

## Global Constraints

- Never use the `$` symbol in UI text or as an identifier alias. Currency is `QAR`. SQL placeholders and template literals are unaffected.
- A missing figure stays blank in storage and displays as "Not submitted", never 0. A typed 0 is a real value.
- Month index is 0-11 everywhere, matching `MONTHS` in `lib/al-manzil.ts`.
- Pure logic lives in `lib/*.ts` with relative imports, so `npm test` can load it without the `@/` alias.
- Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before writing the route handler.
- Create the branch `feature/company-five-sections` before Task 1. Do not stage the unrelated deletion of `components/admin/ui/checkbox.tsx`.
- `.env.local` points development at the shared database, and schema changes apply on the next dev server start. Only add tables and columns. Use a temporary company for browser checks and delete it afterwards.

## Review Focus

1. A file for the wrong company or year is uploaded: reject it and change nothing. Test in Task 2.
2. A blank cell must not become 0, and a blank month must not overwrite stored data. Tests in Tasks 2 and 4.
3. Excel gives text numbers ("1,200") or formula cells: read the actual value, and reject text that is not a number. Tests in Tasks 2 and 3.
4. A P&L template with 12 month columns would zero other months, because `uploadPnl` reads blanks as 0 and replaces every month column in the file. The P&L template therefore carries one month only. Test in Task 3.
5. A correct re-upload replaces that month, and a wrongly uploaded month can be removed. Test in Task 2 for the month grouping; browser check in Task 5.

---

### Task 1: Profile fields

**Files:**
- Modify: `lib/schema.ts`, `lib/company-input.ts`, `lib/companies.ts`, `app/admin/companies/actions.ts`, `components/admin/CompanyForm.tsx`
- Test: `lib/company-input.test.ts`

**Interfaces:**
- Produces: `Company` gains `legal_name: string; ownership_pct: number | null; started: string; erp_code: string; data_owner: string`. `CompanyInput` gains `legalName, ownershipPct, started, erpCode, dataOwner`.

- [ ] **Step 1: Write the failing tests**

Update the exact-match test at `lib/company-input.test.ts:11` to expect `legalName: "", ownershipPct: null, started: "", erpCode: "", dataOwner: ""`. Add:

```ts
test("parses profile fields", () => {
  const ok = parse(form({ name: "A", sector: "log", legalName: " A WLL ", ownershipPct: "75.5", started: "2024-03-01", erpCode: "501", dataOwner: "Finance" }));
  assert.deepEqual("data" in ok && [ok.data.legalName, ok.data.ownershipPct, ok.data.started, ok.data.erpCode, ok.data.dataOwner], ["A WLL", 75.5, "2024-03-01", "501", "Finance"]);
});

test("rejects bad ownership and start date", () => {
  assert.ok("error" in parse(form({ name: "A", sector: "log", ownershipPct: "101" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", ownershipPct: "-1" })));
  assert.ok("error" in parse(form({ name: "A", sector: "log", started: "2024-13-40" })));
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL on the new fields.
- [ ] **Step 3: Implement.**
  - `parseCompany`: blank ownership gives `null`; a blank start date stays `""`; a start date must be a real `YYYY-MM-DD` date. Text limits: legal name 160, ERP code 20, data owner 120.
  - `lib/schema.ts`: `ALTER TABLE app.companies ADD COLUMN IF NOT EXISTS` for `legal_name`, `started`, `erp_code` and `data_owner` (`TEXT NOT NULL DEFAULT ''`), and `ownership_pct NUMERIC(5,2)`.
  - `COLS` in `lib/companies.ts`: add the columns, selecting `ownership_pct::float8 AS ownership_pct`.
  - `saveCompany`: write the five fields in all four SQL branches.
  - `CompanyForm`: add five `Field`s in the existing grid. The start date uses `type="date"`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat: add company profile fields`.

### Task 2: Section rules and upload validation

**Files:**
- Create: `lib/company-data.ts`
- Test: `lib/company-data.test.ts`

**Interfaces:**
- Produces:

```ts
export const SECTIONS: readonly (readonly [Section, string])[]; // profile "Profile", pnl "P&L", balance "Balance sheet and cash", budget "Budget", people "People"
export type Section = "profile" | "pnl" | "balance" | "budget" | "people";
export type FigureSection = "balance" | "budget" | "people";
export type Cell = string | number | null;
export type Figure = { year: number; month: number; line: string; value: number };
export type MonthStatus = "Submitted" | "Not submitted" | "Not due";
export const LINES: Record<FigureSection, readonly string[]>;
export const isFigureSection: (s: string) => s is FigureSection;
export function templateTitle(company: string, section: FigureSection, year: number): string; // "Al Manzil | Budget | 2026"
export function parseGrid(section: FigureSection, grid: Cell[][], expected: { company: string; year: number }, today: Date): { error: string } | { figures: Figure[] };
export function monthStatuses(section: "pnl" | FigureSection, year: number, filled: Set<number>, today: Date): MonthStatus[];
export function profileGaps(c: { legal_name: string; ownership_pct: number | null; started: string; erp_code: string; data_owner: string }): string[]; // labels of blank fields
```

`LINES` values:
- `balance`: Cash at bank; Receivables: current, 1-30 days, 31-60 days, 61-90 days, over 90 days; Stock; Fixed assets; Other assets; Payables: current, 1-30 days, 31-60 days, 61-90 days, over 90 days; Loan balance; Other liabilities; Equity; Loan repayments due in 12 months. Write each aged line in full, such as `Receivables: 1-30 days`.
- `budget`: Revenue; Direct cost; Overheads. Net profit is calculated, never stored.
- `people`: Headcount; Payroll cost; Joiners; Leavers.

Grid layout: row 0 is `[title]`; row 1 is `["Line", "Jan", …, "Dec"]`; each further row is a line name followed by 12 cells.

- [ ] **Step 1: Write the failing tests** using a `grid(section, rows)` helper, with `today = new Date(2026, 10, 4)`:

```ts
test("reads filled months and ignores blank ones", /* budget, Jan filled, rest null → 3 figures, all month 0 */);
test("keeps a typed zero as a figure", /* Overheads 0 → value 0 */);
test("rejects a file for another company or year", /* error names the expected company; same for year */);
test("rejects unknown, missing and duplicate lines", /* one error each, naming the line */);
test("rejects text that is not a number but reads 1,200", /* "abc" → error naming line and month; "1,200" → 1200 */);
test("rejects a partly filled month", /* Budget Jan with Revenue only → error naming Jan and the missing lines */);
test("rejects negatives except cash at bank", /* Stock -1 → error; Cash at bank -1 in a balanced month → figures */);
test("requires whole numbers for headcount, joiners and leavers", /* 1.5 → error; Payroll cost 1.5 → figures */);
test("rejects a balance sheet that does not balance", /* difference 2 → error with month and difference; difference 1 → figures */);
test("excludes the loan repayment memo from the balance check", /* memo 999 in a balanced month → figures */);
test("rejects future months for balance and people but not budget", /* Dec 2026 */);
test("rejects a file with no figures", /* all blank → error */);
test("monthStatuses marks months", /* people 2026, filled {0}: Jan Submitted, Feb Not submitted, Nov Not submitted, Dec Not due; budget Dec with no figures Not submitted */);
test("profileGaps lists blank fields", /* blank data_owner → includes "Data owner" */);
```

Balance rule: cash, receivables, stock, fixed assets and other assets must equal payables, loan balance, other liabilities and equity, within QAR 1.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `lib/company-data.ts`.** Compare titles trimmed and case-insensitively. Return the first error found, naming the line and month. Do not import anything from `lib/al-manzil.ts`, because it uses the file system and ExcelJS; keep a local month list.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat: add company section rules and upload validation`.

### Task 3: Excel templates

**Files:**
- Create: `lib/company-template.ts`, `app/api/companies/[id]/template/route.ts`
- Test: `lib/company-template.test.ts`

**Interfaces:**
- Consumes: `LINES`, `templateTitle`, `parseGrid`, `Cell`, `FigureSection` from Task 2; `listAccounts`, `getCompany`.
- Produces:

```ts
export function buildFigureTemplate(company: string, section: FigureSection, year: number): ExcelJS.Workbook;
export function buildPnlTemplate(year: number, month: number, accounts: { main: string; sub: string }[]): ExcelJS.Workbook;
export function gridFromWorkbook(wb: ExcelJS.Workbook): Cell[][]; // first visible sheet; formula cells give their result; blank gives null
```

Route: `GET /api/companies/[id]/template?section=&year=&month=` returns the `.xlsx` as a download. It returns 400 for a bad section, year or month, 404 for an unknown company, and 400 for `profile`. `month` is required for `pnl` only.

- [ ] **Step 1: Write the failing tests:**

```ts
test("a filled template survives a save and reload", /* build budget template, fill Jan, writeBuffer, load, gridFromWorkbook, parseGrid → 3 figures */);
test("formula cells give their calculated value", /* cell value { formula: "1+1", result: 2 } → 2 */);
test("blank cells stay blank", /* unfilled cell → null, not 0 */);
test("P&L template has exactly one month column", /* row 1: A1 "Main account", D1 "Account", E1 "Oct-2026", F1 empty; row 3: A main, D sub */);
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement both files.** The P&L layout must match `uploadPnl`: headers in row 1, row 2 empty, main account in column 1, account in column 4 and the month in column 5, with data from row 3. Add a one-line comment explaining that one month prevents blanks overwriting other months. Sanitise the download filename to letters, digits and hyphens.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat: add company data templates`.

### Task 4: Storage and upload actions

**Files:**
- Modify: `lib/schema.ts`
- Create: `lib/company-figures.ts`, `app/admin/companies/figure-actions.ts`

**Interfaces:**
- Consumes: `parseGrid`, `isFigureSection`, `Figure`, `FigureSection` from Task 2; `gridFromWorkbook` from Task 3; `numbering`, `q`, `addLog` from `lib/db.ts`.
- Produces:

```ts
// lib/company-figures.ts
export const listFigures: (companyId: number, section: FigureSection, year: number) => Promise<Figure[]>;
export const saveFigures: (companyId: number, section: FigureSection, figures: Figure[]) => Promise<void>; // one transaction, upsert
export const deleteFigureMonth: (companyId: number, section: FigureSection, year: number, month: number) => Promise<void>;

// app/admin/companies/figure-actions.ts
export type FigureUploadState = { error?: string; ok?: string };
export async function uploadFigures(s: FigureUploadState, f: FormData): Promise<FigureUploadState>; // fields: companyId, section, year, file
export async function removeFigureMonth(f: FormData): Promise<void>; // fields: companyId, section, year, month
```

- [ ] **Step 1: Add the table to `lib/schema.ts`:**

```sql
CREATE TABLE IF NOT EXISTS app.company_figures(company_id INTEGER NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  section TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK (month BETWEEN 0 AND 11), line TEXT NOT NULL,
  value NUMERIC(18,2) NOT NULL, updated TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(company_id, section, year, month, line));
```

- [ ] **Step 2: Implement `lib/company-figures.ts`.** Select `value::float8`. `saveFigures` uses `numbering` for its transaction and `ON CONFLICT … DO UPDATE SET value, updated`. Months absent from the file are left untouched.
- [ ] **Step 3: Implement the actions.** `uploadFigures` checks the section and company, loads the workbook (returning "Could not read that file as an Excel workbook." on failure), runs `parseGrid` with `new Date()`, saves, calls `addLog` with the company and section names, revalidates `/admin/companies/[id]` and returns the month count. On any error, nothing is saved. `removeFigureMonth` validates its fields, deletes, logs and revalidates.
- [ ] **Step 4: Run `npm test` and `npx tsc --noEmit`.** Expected: both pass. Database behaviour is checked in Task 5.
- [ ] **Step 5: Commit** with `feat: store company figures`.

### Task 5: The five-section page

**Files:**
- Modify: `app/admin/companies/[id]/page.tsx`
- Create: `components/admin/CompanySectionNav.tsx`, `components/admin/FigureSectionView.tsx`, `components/admin/PnlSectionView.tsx`, `components/admin/UploadFigures.tsx`

**Interfaces:**
- Consumes: everything above; `UploadReport`, `ConfirmButton`, `Table`, `Badge`, `keyFor`, `plRows`, `years`, `link`.
- Produces: `/admin/companies/[id]?section=&year=`. A bad or missing `section` shows `profile`. A bad or missing `year` shows the current year.

- [ ] **Step 1: Build the page.**
  - **Header:** keep the company card and previous and next buttons. Previous and next keep the current section.
  - **Navigation:** five `Button asChild` links, the current one marked `aria-current="page"` and `variant="secondary"`. Each shows a count such as `P&L 9/10`, counting Submitted months against months due in the selected year. Profile shows `Complete` or the number of blank fields.
  - **Profile:** `CompanyForm` and the existing delete card.
  - **P&L:** year links, `UploadReport`, a link to `/admin/finance?company=<id>&year=<year>`, and a table of 12 months with status and a Template link per month. A month counts as filled when any line has a non-zero value. Add this comment: `// shortcut: P&L CSV stores blanks as 0, so a zero month reads as not submitted; fix when P&L moves to the database.`
  - **Balance, Budget, People:** year links, a Download template button, `UploadFigures`, and a table with lines down and months across. Missing months show "Not submitted" in the column header area, with blank cells below, never 0. Each submitted month has a Remove `ConfirmButton`. Budget adds a calculated Net profit row. Show amounts with the `n` formatting from `app/admin/finance/page.tsx`, and label money as QAR.
- [ ] **Step 2: Run `npm test`, `npx tsc --noEmit` and `npm run lint` if present.** Expected: pass.
- [ ] **Step 3: Check in the browser.** Start the `dev` server with `preview_start`, create a temporary company, then confirm:
  - All five sections open, and existing Al Manzil P&L data appears in its section.
  - A filled Budget template uploads and displays. Re-uploading a changed figure replaces it.
  - The Budget template for another company is rejected, and the stored figures don't change.
  - An unbalanced balance sheet is rejected with its month and difference.
  - Blank months display as Not submitted, and Remove clears a month.
  - A one-month P&L template downloads and uploads to the temporary company, and only that month changes.
  - The console and server logs show no errors.
- [ ] **Step 4: Clean up.** Delete the temporary company, which removes its figures through the cascade. Also delete the `data/pl-<id>.csv` file its P&L upload created, then confirm `git status` shows no stray data files.
- [ ] **Step 5: Commit** with `feat: add five-section company page`.
