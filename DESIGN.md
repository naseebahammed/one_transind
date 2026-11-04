# Admin design system

Status: **proposal**. No pages or components were changed. Tokens are in [app/admin/tokens.css](app/admin/tokens.css) (not imported yet).

Scope: `/admin` only (`app/admin/**`, `components/admin/**`, incl. the shadcn `ui/` primitives). The public dashboard uses a separate dark theme in `app/globals.css` and is out of scope.

Method: grep of Tailwind classes, hex/oklch literals and inline styles. Counts are approximate (class occurrences, not rendered elements).

---

## 1. What is in use today

Stack: Tailwind v4 + shadcn "new-york", tokens in `app/admin/admin.css` (light only).

### Colour

| Role | Values found | Problem |
|---|---|---|
| Blue | `--primary` oklch(.546 .215 262), `--ring` oklch(.6 .16 262), chart hex `#2563eb`, `bg-blue-500` (chart bar), `blue-100`/`blue-700` (tone.blue, unused), page bg tint hue 255, sidebar navy (.21/.045/265), sidebar-accent (.3/.055/265), sidebar-border (.3/.04/265) | **4 competing "brand" blues** (primary, ring, `#2563eb`, `blue-500`) that are close but not equal; 10 blue-family values total |
| Red | `--destructive` oklch(.577 .245 27), `text-red-600` (finance negatives, upload error), chart hex `#dc2626`, `red-100`/`red-700` (tone.red), plus `destructive` at /10 /20 /40 /50 /60 /90 alpha | 4 reds from 4 sources; same meaning ("bad") expressed as `text-destructive` in some files and `text-red-600` in others |
| Green | `text-emerald-600` (upload ok), chart `#059669`, `emerald-100`/`emerald-700` (tone.green) | Success text is 600 in one place, 700 in badges, hex in charts |
| Amber | chart `#f59e0b`, `amber-100`/`amber-700` (tone.amber, unused) | Not a token |
| Neutrals | grey chroma 0: `muted`/`secondary`/`accent` (all identical .97), `border`=`input` (.922), `muted-foreground` .556; **plus** `slate-100`/`slate-600` (tone.gray), `bg-white`, `text-white`, `bg-black/50` | Two neutral families (pure grey vs. cool slate) next to a blue-tinted background; `muted`, `secondary`, `accent` are the same colour under three names |
| Alpha steps | `bg-muted` /30 /40 /50, `bg-input` /30 /50 /80, `secondary` /80 /90, `primary` /90, `sidebar-foreground` /50 /60 /70 | Ad-hoc hover/zebra opacities, no rule |
| Dark mode | 19 `dark:` utilities, but the `dark` variant is bound to `.dark *` which is never applied | Dead code carried in every primitive |

Hard-coded colour outside tokens: `app/admin/page.tsx:32` (4 hex), `FinanceCharts.tsx` (`bg-blue-500`, inline `currentColor` opacities), `finance/page.tsx:20` (`text-red-600`), `UploadReport.tsx:25-26`, `AdminSidebar.tsx` (`bg-white`, `text-white`), `tones.ts`.

### Typography

- **Family**: admin body is `ui-sans-serif, system-ui`; `layout.tsx` loads IBM Plex Sans Arabic, Almarai and IBM Plex Mono for every route but admin uses none of them (3 `font-mono` uses fall back to the browser mono). Two font stacks, one unused download.
- **Sizes** (class counts): `text-sm` 37, `text-xs` 19, `text-base` 2, `text-lg` 1, `text-2xl` 1, `text-3xl` 1, plus raw SVG/inline sizes **11px and 13px** in `FinanceCharts.tsx`. That is 8 sizes where 5 would do.
- `text-base` is used for two different jobs: `Input` mobile size (`text-base md:text-sm`) and `CardTitle` override in `CompanyForm`.
- **Weights**: `font-medium` 17, `font-semibold` 10. Fine, but headings are inconsistent: h1 = `2xl semibold tracking-tight`, h2 (finance) = `lg semibold`, `CardTitle` = default size `semibold leading-none` (so a card title is *smaller* than an h2 and the same as body).
- `tracking-tight` used once (h1 only).

### Spacing

- 4px grid in spirit, but **half-steps** appear: `py-0.5`, `px-1.5`, `py-1.5`, `gap-1.5`, `px-2.5`, `mx-3.5`.
- Padding values in use: px 1/1.5/2/2.5/3/4/6, py 0/0.5/1/1.5/2/3/4/6, gap 0/1/1.5/2/3/4/6 (+ `gap-x-8`), `space-y` 1/1.5/2/3/4/6.
- Table cells: finance raw table uses `px-1`, `px-2`, `py-1`, `py-1.5`, `py-2`, `pl-5`; the `Table` primitive uses `px-2`/`h-10`. Three table paddings.
- **Card padding** (default `py-6 gap-6 px-6`) is overridden in 5 different ways: `gap-1 py-4`, `gap-0 py-0`, `gap-2 py-3`, `px-6 py-2`, `px-6 py-3` (the last two are the same "summary strip" on two pages with different `py`).

### Radius

`rounded-md` 24, `rounded-xl` 5, `rounded-full` 3, `rounded-lg` 2, bare `rounded` (4px) 2, `rounded-sm`, `rounded-xs`, `rounded-[4px]` (checkbox), SVG `rx=2`, inline `borderRadius: 2`. Resolved sizes: 2, 4, 6, 8, 10, 14, full = **7 radii**. Cards are 14px, the table container inside a card is 8px, the finance raw table wrapper is 14px.

### Shadow

`shadow-xs` 6, `shadow-sm` 3 (Card), `shadow` 4, `shadow-md` 1 (select popup), `shadow-lg` 1 (sheet), `shadow-none` 1, one arbitrary ring-shadow in the sidebar. Controls vs. cards vs. overlays do not map cleanly to levels.

### Controls

| Control | Heights / sizes in use |
|---|---|
| Button | sizes xs 24, sm 32, default 36, lg 40, icon 36, icon-xs 24, icon-sm 32, icon-lg 40. Real usage: default, sm, xs, icon-sm only. Plus a one-off override `h-7 px-2 text-xs` on an `sm` button (CompanyForm:68) that fits no size |
| Input | 36 default; 32 via `className="h-8"` in AccountsList; `text-base md:text-sm` |
| NativeSelect | 36, `px-3`, shadow-xs |
| Select trigger | 36/32 via data-size |
| Raw `<select>` / `<input>` (UploadReport:19,22) | 36 but `px-2`, no `shadow-xs`, no focus ring, `bg-background` instead of transparent, default border colour instead of `border-input` |
| Raw `<input type=file>` | unstyled, `text-sm` only |
| Raw `<table>` (finance:206) | bypasses the `Table` primitive |

Button variants: 6 defined (default, destructive, outline, secondary, ghost, link). Used: default, outline, ghost, **secondary**. `destructive` has no direct use (`ConfirmButton` is a plain default button, so "delete" looks like "save"). `secondary` is used to mean *toggled/active* (hide toggle, selected year), while `outline` is the unselected state; nothing documents that.

Badges: shadcn variants (default/secondary/destructive/outline/ghost/link) **plus** a parallel system in `tones.ts` applied via `className` (green/blue/amber/gray/red; only green, red, gray used). Status badges therefore do not use tokens.

Cards: base `rounded-xl border shadow-sm`; used as (a) section container, (b) stat tile (`gap-1 py-4`), (c) summary strip (`flex-row`, `py-2` or `py-3`), (d) danger zone (`border-destructive/40`, title `text-destructive`), (e) table frame (`gap-0 overflow-hidden py-0`) and a hack `[&_[data-slot=table-container]]:border-0` to remove the table's own border when nested.

### Architecture issues that cause the above

1. Two token systems: legacy `:root` vars in `globals.css` (`--muted`, `--line`, ...) and `.admin` vars in `admin.css`, with workarounds (`:not(.admin *)`, `.admin :is(h1,h2,h3)` reset, popup selectors repeated for portals).
2. shadcn defaults were copied wholesale (8 button sizes, 6 badge variants, `dark:` everywhere) then overridden per page instead of being narrowed.
3. Status colours and chart colours live in call sites, not tokens.

---

## 2. Proposed system

Principle: **keep the shadcn token names** (`--primary`, `--muted`, `--border`, ...) so no component API changes, but shrink every scale and move status/chart colours into tokens.

Source of truth: [app/admin/tokens.css](app/admin/tokens.css).

### Colour

- **One neutral family**, cool (hue 255-265), matching the navy sidebar. Retire pure-grey and `slate-*`.
- **One brand blue** `--primary` = oklch(.546 .215 262) (≈ `#2563eb`). `--ring` is that same colour at 50%. Chart series 1 = `--primary`.
- **Status** (success / warning / danger / info) each get a solid (`--success`, ...) and a soft pair (`--success-soft` + `--success-soft-foreground`) for badges. `--destructive` is danger. Info = primary.
- `--secondary` and `--accent` stay as aliases of `--muted` (3 names, 1 value, documented).
- **Chart palette** `--chart-1..4` = blue, green, amber, red.
- **Alpha rule**: hover on solid = 90%; zebra/subtle fill = `bg-muted/50`; nothing else. Disabled = 50% opacity.
- Light theme only. Delete `dark:` utilities and the dead `dark` variant when touching each primitive.

### Typography

| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | meta, table head, badges, chart labels |
| `text-sm` | 14 / 20 | **body**, controls, table cells |
| `text-base` | 16 / 24 | card titles |
| `text-lg` | 18 / 28 | section heading (h2) |
| `text-2xl` | 24 / 32 | page title (h1) and KPI value |

Weights: 400 body, 500 labels/buttons, 600 headings/KPIs. `tabular-nums` on all numeric table cells and KPIs.
Family (decided): **system stack** (`ui-sans-serif, system-ui`; mono `ui-monospace, Consolas`), no web fonts in admin. This is what admin already renders, so nothing shifts visually. Follow-up: the Google Fonts `<link>` in `app/layout.tsx` is loaded for every route; move it to the public layout (or lazy-load it there) so admin stops downloading unused fonts. Arabic names fall back to the OS Arabic font.
Inputs are `text-sm` at all widths (remove `text-base md:text-sm`; iOS zoom is the only reason for it, so use `text-base` on `max-md` only if mobile admin editing matters).

### Spacing

4px grid; **allowed steps**: 1 (4), 2 (8), 3 (12), 4 (16), 6 (24), 8 (32). No half-steps.

| Token | Value | Use |
|---|---|---|
| `--page-gutter` | 16, 32 from md | `main` padding |
| `--section-gap` | 24 | between page sections (`space-y-6`) |
| `--card-pad` | 24 | default card |
| `--card-pad-compact` | 16 | stat tiles, summary strips, nested tables |
| `--header-h` | 56 | top bar |
| inline gap | 8 (related controls), 16 (groups) | `gap-2`, `gap-4` |
| table cell | `px-3 py-2` | all tables (single density) |

### Radius, shadow

- Radius: **sm 4** (checkbox, chart bars), **md 8** (buttons, inputs, selects, table frame, popovers), **lg 12** (cards, sheets), **full** (badges, switch). `rounded-xl` becomes an alias of `lg` until migrated.
- Shadow: **xs** controls (input, outline button), **sm** cards, **md** overlays (select popup, sheet). `lg` is an alias of `md`; `shadow-none` only where a primitive needs to cancel one.

### Components

**Button** (cut from 6 variants x 8 sizes to what is used):

| Variant | Use |
|---|---|
| `default` | one primary action per view (Save, Add, Upload) |
| `outline` | secondary actions, row actions, **unselected** toggle |
| `secondary` | **selected/active** toggle state only |
| `ghost` | cancel, tertiary, icon-only |
| `destructive` | delete (ConfirmButton should default to this) |
| `link` | inline text actions (replaces `text-primary hover:underline` anchors) |

Sizes: `default` 36, `sm` 32, `icon` 36, `icon-sm` 32. Drop `xs`, `lg`, `icon-xs`, `icon-lg` and the `h-7 px-2 text-xs` override. Focus: 3px `--ring`.

**Input / NativeSelect / Select / file input**: one recipe: height `--control-h` (36) or `--control-h-sm` (32, dense rows only), `rounded-md`, `border-input`, `bg-transparent`, `shadow-xs`, `text-sm`, 3px ring on focus, `aria-invalid` -> `border-destructive`. Replace the raw `<select>`/`<input>` in `UploadReport` with `NativeSelect`/`Input`; add a styled file-input variant (`file:` utilities already exist in `Input`). Labels: `Label`, `text-sm font-medium`; helper/error text `text-xs`, error uses `text-destructive` (not `red-600`).

**Card**: `rounded-lg border bg-card shadow-sm`, padding via two sizes only (default 24, `compact` 16). Variants as props, not class overrides: `Card` (section), `Card compact` (stat tile / summary strip, `flex-row` allowed), `Card tone="danger"` (`border-destructive/40`, title `text-destructive`), `Card flush` (table frame: `p-0 gap-0 overflow-hidden`, and `Table` drops its own border when inside, removing the `[&_[data-slot=table-container]]` hack). `CardTitle` = `text-base font-semibold`.

**Table**: always use the `Table` primitive (migrate `finance/page.tsx` raw table); header `bg-muted text-xs font-medium text-muted-foreground`, cells `px-3 py-2`, numeric columns `text-right tabular-nums`, negatives `text-destructive`.

**Badge**: keep `default | secondary | outline` and **replace `tones.ts` with status variants** `success | warning | danger | info | neutral` mapped to the `*-soft` tokens. Always `rounded-full text-xs font-medium px-2 py-0.5` (20px tall; the one intentional sub-step on the 4px grid).

**Charts**: colours from `--chart-n` (read via `getComputedStyle` or pass `var(--chart-1)` as the SVG `fill`), axis/legend text `text-xs` (12), bar radius `--radius-sm`, bars in `HBars` use `bg-primary` not `blue-500`; replace inline `style` legends with classes.

**Page chrome**: header `h-14 border-b bg-card`; `main` `max-w-7xl p-4 md:p-8`, sections `space-y-6`; h1 `text-2xl font-semibold tracking-tight`, h2 `text-lg font-semibold`.

---

## 3. Migration map (old -> new)

| Old | New |
|---|---|
| `text-red-600`, `#dc2626` | `text-destructive`, `var(--chart-4)` |
| `text-emerald-600`, `#059669` | `text-success`, `var(--chart-2)` |
| `#2563eb`, `bg-blue-500` | `bg-primary`, `var(--chart-1)` |
| `#f59e0b` | `var(--chart-3)` |
| `tone.green/red/gray/blue/amber` | `<Badge variant="success|danger|neutral|info|warning">` |
| `bg-white` (logo chip), `text-white` (sidebar name) | `bg-card`, `text-sidebar-accent-foreground` |
| `rounded-xl` | `rounded-lg` |
| `rounded` (bare), `rounded-xs`, `rounded-[4px]` | `rounded-sm` |
| `shadow` (bare), `shadow-md`/`shadow-lg` | `shadow-sm` for cards, `shadow-md` for overlays |
| `text-3xl` (KPI) | `text-2xl` |
| `text-base` on `Input` | `text-sm` |
| SVG/inline `fontSize` 11 / 13 | `text-xs` (12) |
| `py-1.5`, `px-1.5`, `gap-1.5`, `px-2.5`, `py-0.5` | nearest of 1 / 2 / 3 (badge `py-0.5` is the single exception) |
| Card `gap-1 py-4`, `gap-2 py-3`, `py-2`, `py-3`, `gap-0 py-0` | `Card compact`, `Card flush` |
| `Button size="xs"`, `h-7 px-2 text-xs` | `size="sm"` |
| raw `<select>`/`<input>` in UploadReport | `NativeSelect` / `Input` |
| raw `<table>` in finance | `Table` |

## 4. Suggested rollout (each step shippable alone)

1. Import `tokens.css` in `admin.css` in place of its token blocks; aliases keep every current class working (visual change: neutrals and borders shift slightly cooler).
2. Add Badge status variants, delete `tones.ts`; swap the three hard-coded reds/greens.
3. Chart colours -> `--chart-n`; remove inline styles in `FinanceCharts`.
4. Card `compact`/`flush`/`tone` props; clean the 5 padding overrides.
5. Narrow Button sizes; fix `ConfirmButton` default variant; replace the raw controls and raw table.
6. Remove `dark:` utilities, `rounded-xl`/`shadow-lg` aliases, then the text-size and half-step stragglers.

## 5. Decisions needed

- Is mobile editing of admin forms a requirement? That decides whether inputs keep 16px text on small screens.
- Is dark mode ever planned for admin? If not, remove the `dark:` utilities now.
- Table density: one density (`py-2`) proposed; finance P&L grids (dense numeric) may want a `compact` table with `py-1`.
