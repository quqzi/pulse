# Pulse — CLAUDE.md

Study tracker for TCAS exam prep. SvelteKit 2 + TypeScript + Supabase, deployed to Vercel.

**Repo:** https://github.com/quqzi/pulse · **Live:** https://pulse-hazel-ten.vercel.app · **Branch:** `master` (auto-deploys on push)

Works two ways: **guest** (fully offline, `localStorage`) and **authenticated** (Supabase + RLS). Every data path must support both.

---

## Session Start — do this first, every conversation

1. Read **Active Plans** at the bottom — know what's open and what's done.
2. Figure out which plan the user's task fits, or ask if it's unclear.
3. Never start implementing without knowing where it lands in the plan list.

---

## Commands

```bash
npm run dev      # dev server → localhost:5173
npm run check    # type-check — zero errors before every commit
npm run build    # production build
npm run preview  # preview the production build locally
npx vitest run   # unit tests (data engine, mappers, srs, scheduler)
```

`.env.local` (never commit) needs `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` (Supabase → Settings → API). Guest mode runs without them.

---

## Workflow

Pick the tier by scope. The **default loop** is the floor for almost everything — don't skip its check/verify/review steps even on small changes.

### Default loop — most changes

1. Know where it fits (Active Plans) and follow existing patterns + the Recipes below.
2. `npm run check` — zero type errors.
3. **Browser-verify the exact thing you changed** (`chrome-devtools-mcp:chrome-devtools`, or the `verify` skill). Reproduce the precise scenario.
4. Review your own diff — `code-review:code-review` for anything non-trivial.
5. `commit-commands:commit`.

### Big feature — new route, new data flow, or multi-file

Wrap the default loop in design + finish steps:

1. `superpowers:brainstorming` — design + spec.
2. `superpowers:writing-plans` — write the plan to `docs/superpowers/plans/`.
3. `ui-ux-pro-max:ui-ux-pro-max` — validate any new page/component UI before building.
4. `superpowers:subagent-driven-development` — execute the plan task-by-task.
5. → run the **default loop** on the result.
6. `superpowers:verification-before-completion` → `superpowers:finishing-a-development-branch` → `commit-commands:commit-push-pr`.
7. Move the plan **Open → Completed** in Active Plans and commit that.

### Bug fix — always diagnose before touching code

1. **Reproduce it** in the browser — see it yourself, note actual vs. expected.
2. **Scan the Gotchas table** — most recurring bugs are already documented there.
3. **Route by symptom** (table below).
4. Make the **minimal** fix → `npm run check` → re-verify the exact scenario → `commit`.
5. **Escalate after 2 real attempts** (root-caused + targeted fix + tested, still broken) → `superpowers:systematic-debugging`.

| Symptom | Look first |
|---|---|
| TS error / red squiggle | `npm run check` — read the full error, jump to file:line |
| Visual / layout wrong | `chrome-devtools-mcp:chrome-devtools` — inspect computed styles |
| White screen / crash | `chrome-devtools-mcp:troubleshooting` — console errors |
| Data not showing / stale | `loadData($auth)` missing in `onMount`? store accessed via `$store`? |
| Supabase returns empty | RLS — `execute_sql` to confirm rows exist + `auth.uid() = user_id` |
| Works in guest, broken when logged in | auth-mode branch — check `getAuthContext()` returns the right `mode` |
| Works on load, breaks on nav | add `$: if ($auth.mode !== 'loading') loadData($auth)` |
| CSS token missing in some themes | the token must exist in **all five** theme blocks in `app.css` |

### After a merge — sync ritual

When a PR merges to `master`, fast-forward the local checkout so it never drifts:

```bash
git -C "C:/Users/HP/Documents/pulse" pull --ff-only origin master
```

Then confirm the merged plan is in **Completed** (not still Open).

> **Production actions need explicit go-ahead.** Merging a PR, pushing to `master`, and applying a Supabase migration affect prod. State what you're about to do and wait for the user's explicit OK before each — guest-mode work and local commits don't need it.

### When in doubt — ask first

One clarifying question is cheaper than a wrong implementation. Ask when the call isn't obvious: component vs. inline · i18n string vs. hardcoded · logic in a repo, a store, or the page · new writable vs. derived · which nav group (Main / Track).

---

## Data Layer — the repo engine (`src/lib/data/`)

`db.ts` was deleted (WS1.3c). **All persistence goes through the repository engine.** One repo per entity, bound to one store. `load` / `save` / `remove` **write through to the bound store** — never manually `.set()` the store after calling them.

```
src/lib/data/
  stores.ts       # one writable per entity (subjects … examQuestions, examSessions)
  mappers.ts      # xFromRow / xToRow — snake_case row ↔ camelCase type
  entities.ts     # the repos: repo<T>({…}) + bespoke methods (cascade, windowed, log)
  repository.ts   # repo() factory — binds the engine to authCtx + local/supabase adapters
  engine.ts       # pure engine: createRepository, writeThrough, loadInto
  adapters/       # local.ts (localStorage)  +  supabase.ts
  ls.ts           # lsRead / lsWrite — bulk guest-path helpers
  authctx.ts      # authCtx derived + getAuthContext()
```

A plain entity is **one `repo()` call**:

```ts
export const thingsRepo = repo<Thing>({
  store: things,            // the writable from stores.ts
  lsKey: 'pulse.things',    // localStorage key — DOT namespace, NOT pulse_*
  table: 'things',          // Supabase table
  toRow: thingToRow,
  fromRow: thingFromRow,
  orderColumn: 'created_at',
  ascending: false,
  order: (a, b) => b.createdAt.localeCompare(a.createdAt),  // in-store sort
});
// → thingsRepo.load() / .save(item) / .remove(id) — all write-through, both modes
```

- **Mode switch lives in the engine.** Guest → localStorage (`pulse.*`); authenticated → Supabase (RLS `auth.uid() = user_id`). Repo callers never branch on mode.
- **Errors** are caught in the engine and surfaced via `toast.error` — no try/catch in pages.
- **Bespoke methods** (cascade delete, windowed load, insert-only log) wrap `writeThrough` / `loadInto` with an explicit snapshot/rollback — see `subjectsRepo.removeCascade`, `topicsRepo.create`, `srsRepo.update`, `sessionsRepo.log`/`load`, `scheduleRepo.loadWeek`/`confirmAll`. Multi-store atomic rollback can't go through single-store `writeThrough`, so those snapshot each store manually.
- DB columns are `snake_case`, TS fields `camelCase` — every entity needs a mapper pair in `mappers.ts`.
- IDs come from `newId()` in `$lib/id` (not from any `db.*` helper).

---

## Recipes

Exact patterns for the most repeated tasks. Follow them — don't invent variations.

### New Page

0. `svelte-skills:sveltekit-structure` before creating the file.
1. `src/routes/(app)/pagename/+page.svelte` — import `onMount` (svelte), `auth` (`$lib/stores/auth`), `loadData` + needed stores (`$lib/stores/data`); call `loadData($auth)` in `onMount`, and add `$: if ($auth.mode !== 'loading') loadData($auth)`.
2. Nav entry in `src/lib/components/Sidebar.svelte` groups array: `{ label, href, d: '<SVG path d>' }`. Also `src/lib/components/MoreDrawer.svelte` for mobile.
   - **Main:** dashboard, timer, subjects · **Track:** analytics, journey, tasks, schedule, scores, exam
3. i18n key in **both** `src/lib/i18n/en.ts` and `th.ts`.

### New DB Feature

0. `supabase:supabase-postgres-best-practices` before any schema.
1. **`types.ts`** — `interface MyThing { id; userId; …; createdAt }`.
2. **`data/mappers.ts`** — `myThingFromRow` / `myThingToRow` (snake ↔ camel).
3. **`data/stores.ts`** — `export const myThings = writable<MyThing[]>([])`.
4. **`data/entities.ts`** — `export const myThingsRepo = repo<MyThing>({ store: myThings, lsKey: 'pulse.myThings', table: 'my_things', toRow, fromRow, orderColumn, ascending, order })`.
5. **`stores/data.ts`** — re-export the store; add `myThingsRepo.load()` to `loadData`'s `Promise.all`.
6. **Migration** — `supabase:supabase`; create the table + RLS `auth.uid() = user_id` + a `user_id` index. *Applying to prod is a production action — get explicit go-ahead.*
7. **Page** — call `myThingsRepo.save/remove`; the UI updates via the bound store.

### New Component

- Shared → `src/lib/components/Name.svelte`. Feature-specific (2+ for one feature) → `src/lib/components/feature/`.
- Props `export let propName: Type`; events `createEventDispatcher<{ event: Payload }>()`.
- No barrel `index.ts`, no default exports.
- **Modals/sheets must portal to `<body>`** to escape the trapped stacking context — see the portal gotcha.

### New Setting

1. `src/lib/stores/settings.ts` — add field to `Settings` interface.
2. Same file — default value in `defaults()`. *(auto-persists to localStorage; auth users sync via `data/settingsSync.ts`.)*
3. `src/routes/(app)/settings/+page.svelte` — add the UI control.

### Standard Empty State

```svelte
{#if $items.length === 0}
  <div class="empty-state">
    <p class="empty-title">No X yet.</p>
    <p class="empty-sub">Hint for what to do next.</p>
  </div>
{:else}
  <!-- content -->
{/if}
```
```css
.empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
.empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.empty-sub   { font-size: 13px; color: var(--muted); }
```

No loading spinners — stores start empty and fill fast. No explicit error states — the repo engine catches errors and shows a toast.

---

## Gotchas

| Symptom | Cause & fix |
|---|---|
| Store value stale / not reactive | Read via `$store` in templates, `get(store)` / `.subscribe()` in scripts — never `.value` |
| Data not loading on a page | Call `loadData($auth)` in `onMount`, not module scope |
| UI didn't update after save | `repo.save/remove` already write through to the store — don't also `.set()` it (double update / fights the engine) |
| Wrong localStorage key | Keys are `pulse.thing` (DOT), e.g. `pulse.examQuestions` — not `pulse_thing` |
| New CSS token missing in some themes | All **five** theme blocks in `app.css` need it — check every one |
| Supabase query empty | RLS — every table needs `auth.uid() = user_id`; guest mode never hits Supabase |
| Type error in a repo / mapper | DB returns `snake_case` — map to camelCase in `mappers.ts`, never use raw DB fields in components |
| Chart.js color wrong in dark mode | `getComputedStyle(document.body).getPropertyValue('--primary').trim()` — **`document.body`, NOT `documentElement`**; theme classes live on `<body>`, so `:root` vars don't reflect the active theme |
| Transition causes layout thrash | Never `transition: width/height` — use `transform: scaleX/scaleY` |
| Modal/sheet hidden behind tab-bar | Portal it to `<body>` — page content is trapped in `.main-content`'s stacking context, below the fixed tab-bar. See `BottomSheet`/`ConfirmDialog`/`SubjectEditSheet` `use:portal` |
| Popover button click does the wrong thing | A `setPointerCapture` ancestor redirects the `click` to the capture target — add `on:pointerdown\|stopPropagation` to the popover (see `CalBlock`) |
| Reactive "on open" runs before its writer | Don't split `$: if (open && !was) seed()` / `$: was = open` — combine into one `$: { if (open && !was) seed(); was = open; }` |
| `loadScheduleSlots` gets stale `_userId` | Its reactive must run AFTER `loadData($auth)` in file declaration order — `_userId` is set inside `loadData` |
| Scoped style beats `:global()` | `.cls.svelte-xxx` (0,2,0) > `:global(.cls)` (0,1,0) — use `!important` when a global rule must win |
| SVG `d` can't contain HTML | Don't embed `"/><polyline…` inside a `d` string (Svelte HTML-encodes it) — use multi-subpath `M` commands |
| Text invisible on `--primary` bg in dark | Never `color: white/#fff` on `background: var(--primary)` — use `color: var(--bg)` (always contrasting) |

> Unresolved after 2 attempts → `superpowers:systematic-debugging`.

---

## CSS & Theming

**Never hardcode colors** — use these tokens (defined per-theme in `app.css`):

```
--bg --bg2 --bg3        page / card / hover backgrounds
--border --text --muted borders · primary text · secondary text
--primary --primary-dark --primary-l --primary-rgb   brand accent (varies by theme)
--nav-main --nav-track   sidebar group label colors
--radius-md --font-sans --font-mono
```

For Chart.js, read the computed value off **`document.body`** (theme classes live there):
```js
getComputedStyle(document.body).getPropertyValue('--primary').trim()
```

**Five themes**, one `theme` field in settings; `+layout.svelte` sets body classes `design-vercel|apple|resend` + `theme-dark`:

| Value | Design / mode | `--primary` |
|---|---|---|
| `vercel-light` / `vercel-dark` | Vercel light / dark | `#171717` / `#ededed` |
| `apple-light` / `apple-dark` | Apple light / dark | `#0066cc` / `#2997ff` |
| `resend` | Resend, always dark | `#fcfdff` on true black |

Design language refs: `docs/design/{vercel,apple,resend}.md`.

---

## Skill Index

> Always use **`context7` MCP** for library-specific code (SvelteKit, Supabase JS, Chart.js) — fetch current docs, don't trust training data.
> Never touch schema without **`supabase:supabase-postgres-best-practices`** first.

- **Process** — `superpowers:brainstorming` (design) → `:writing-plans` → `:subagent-driven-development` (execute) → `:verification-before-completion` → `:finishing-a-development-branch`. Stuck after 2 attempts → `:systematic-debugging`. Parallel work → `:dispatching-parallel-agents` / `:using-git-worktrees`.
- **Svelte/Kit** (before writing in an unfamiliar area) — `svelte-skills:sveltekit-structure` (pages/layout), `:sveltekit-data-flow` (stores/load), `:svelte-components`, `:svelte-styling`, `:svelte-runes`, `:svelte-template-directives`, `:svelte-layerchart` (charts), `:ecosystem-guide` (picking a lib).
- **UI / design** — `ui-ux-pro-max:ui-ux-pro-max` (any visual decision), `color-expert` (palette/contrast), `css-animations` / `animate` (motion), `better-i18n` (en.ts + th.ts), `pwa-expert`.
- **Data / deploy** — `supabase:supabase` (any Supabase feature), `:supabase-postgres-best-practices` (schema); `execute_sql` MCP directly for read-only inspection. `vercel:deploy` / `:verification` / `:auth` / `:env`.
- **Browser** — `chrome-devtools-mcp:chrome-devtools` (general), `:troubleshooting` (white screen/console), `:a11y-debugging`, `:debug-optimize-lcp`, `:memory-leak-debugging` (timer page).
- **Review** — `code-review:code-review` (diff before PR), `security-review` (auth/RLS/input), `code-simplifier:code-simplifier` (post-feature cleanup).
- **Git** — `commit-commands:commit` / `:commit-push-pr` / `:clean_gone`. Verify in browser → `verify` · start dev server → `run`.

---

## Reference

### Stack

SvelteKit 2 + TypeScript (Svelte 4 idiom: `export let`, `createEventDispatcher`, scoped CSS) · Supabase JS v2 (Postgres + Auth) · plain CSS custom-property tokens (no Tailwind) · fonts Geist/SF Pro/Inter via `app.html` · Vercel, auto-deploy from `master`.

### Project Structure

```
src/
  app.css                 # global styles, design tokens, theme blocks
  lib/
    components/           # shared UI (Sidebar, HeroCard, BottomSheet, …) + feature subfolders
    data/                 # repo engine — see Data Layer section
    stores/
      auth.ts             # auth state (loading | guest | authenticated)
      data.ts             # re-exports entity stores + derived stores + loadData()
      settings.ts         # theme + study settings (localStorage; auth sync via data/settingsSync.ts)
      timer.ts            # timer state
    types.ts              # all shared TS types
    constants.ts          # TCAS_SUBJECTS, templates, HISTORY_DAYS
    id.ts                 # newId()
    srs.ts                # SM-2 spaced repetition
    supabase.ts           # Supabase client
    i18n/{en,th}.ts
  routes/
    (app)/                # sidebar + content shell
      dashboard/ timer/ subjects/ tasks/ analytics/ schedule/ scores/ journey/ insights/ exam/ settings/
    auth/ onboarding/
```

### Stores (`src/lib/stores/data.ts`)

```ts
// writables (defined in data/stores.ts, re-exported here)
subjects topics srsCards sessions tasks templates scheduleSlots scores examQuestions examSessions
// derived
todaysSessions dueCards todayHours streak tasksDueToday readinessScore
// functions
loadData(authState)        // populate all stores — call in onMount
loadScheduleSlots(ws, we)  // windowed week load (separate from loadData)
getAuthContext()           // { userId, mode }
```

### Auth (`src/lib/stores/auth.ts`)

```ts
type AuthState =
  | { mode: 'loading' }
  | { mode: 'guest';         user: null; name: string }
  | { mode: 'authenticated'; user: User; name: string }
```
Guest mode is fully offline (localStorage); no account required.

### Supabase Tables — all RLS-enabled, policy `auth.uid() = user_id`

`subjects` · `topics` (FK → subject, cascade) · `srs_cards` (one per topic, `UNIQUE(topic_id)`, SM-2 state) · `study_sessions` · `tasks` · `mock_scores` · `templates` · `schedule_slots` · `user_settings` (JSONB per-user) · `exam_questions` · `exam_sessions`.

### Coding Rules

- No hardcoded hex — CSS vars or `getComputedStyle`.
- No `transition: width/height` — `transform: scaleX/scaleY`.
- No comments unless the WHY is non-obvious.
- No extra features beyond what's asked — YAGNI.
- Follow existing patterns — repo methods, store structure, component style.

---

## Active Plans

> **Rule:** When a plan is fully implemented and committed, remove it from **Open** here and add its entry to the top of `docs/CHANGELOG.md`, then commit. Never leave a finished plan in the Open list. (Completed history lives in the changelog, not here — keeps this file lean.)

> **Foundation roadmap:** `docs/superpowers/specs/2026-05-29-pulse-roadmap-and-foundation-design.md` — assessment + WS1–WS6 workstreams (readiness-reviewed). WS1 = data-layer foundation, split into WS1.1–WS1.4.

### Open (ready to implement)

- _None — all written plans implemented._

### Planned (spec'd, plan not yet written)

- WS3 Thai i18n **fan-out** — pilot (infra + nav + dashboard) done & in CHANGELOG; remaining ~11 pages still to convert to `$t`/`$fmt`
- WS4 features · WS5 polish · WS6 motion (see roadmap spec)
- Exam label / tag on topics under a subject (deferred — surfaced 2026-06-04)

### Completed

→ **`docs/CHANGELOG.md`** — full history, newest first (25 plans through WS3 Thai i18n pilot).
