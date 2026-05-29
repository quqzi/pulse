# Pulse — CLAUDE.md

Study tracker app for TCAS exam prep. SvelteKit 2 + TypeScript + Supabase, deployed to Vercel.

**Repo:** https://github.com/quqzi/pulse  
**Live:** https://pulse-hazel-ten.vercel.app  
**Branch:** `master` (auto-deploys to Vercel on push)

---

## Commands

```bash
npm run dev          # Dev server → localhost:5173
npm run check        # Type-check — run before every commit
npm run build        # Production build
npm run preview      # Preview production build locally
```

---

## Environment

Create `.env.local` in the project root (never commit this file):

```
PUBLIC_SUPABASE_URL=...       # Supabase → Project Settings → API → Project URL
PUBLIC_SUPABASE_ANON_KEY=...  # Supabase → Project Settings → API → anon/public key
```

Guest mode works without env vars — Supabase is only contacted when authenticated.

---

## Session Start — Always Do This First

Before doing anything in a new conversation:
1. Read the **Active Plans** section at the bottom of this file — know what's open and what's done
2. Check which plan the user is likely working on, or ask if unclear
3. Never start implementing without knowing where the task fits in the plan list

---

## Claude's Role

Claude is the primary full-stack developer on this project. Every feature goes through a deliberate workflow. Pick the right tier based on scope:

### New Feature / New Page — Full Chain
> Anything that touches multiple files, adds a route, or changes data flow.

1. `superpowers:brainstorming` — design + spec
2. `superpowers:writing-plans` — write plan to `docs/superpowers/plans/`
3. `superpowers:subagent-driven-development` — execute plan task-by-task
4. `ui-ux-pro-max:ui-ux-pro-max` — validate UI decisions before building (any feature with a new page or component)
5. `verify` or `run` — confirm it works in browser
6. `superpowers:verification-before-completion` — self-review checklist
7. `code-review:code-review` — review the diff for bugs before pushing
8. `superpowers:finishing-a-development-branch` — pre-PR checklist
9. `commit-commands:commit-push-pr` — commit, push, open PR

### Small Fix / Tweak — Skip Design
> Single-file changes, CSS fixes, copy edits, bug patches.

1. Route by fix type before touching code:
   - CSS / visual fix → invoke `chrome-devtools-mcp:chrome-devtools` to inspect first
   - Adding user-facing text → invoke `better-i18n` to add to both `en.ts` and `th.ts`
   - Touching auth or RLS → invoke `security-review` first
2. Implement the fix
3. `npm run check` — zero type errors
4. `verify` — confirm fix in browser
5. `commit-commands:commit` — commit

### Bug Fix Workflow
> Any bug, regression, or broken behaviour. Always diagnose before touching code.

**Step 1 — Reproduce it**
Confirm you can see the bug yourself before changing anything. Open the browser, trigger the exact scenario, note what happens vs. what should happen.

**Step 2 — Check the Gotchas table first**
Scan the Pulse-Specific Gotchas section below. Most recurring bugs have a known cause already documented there.

**Step 3 — Route by symptom**

| Symptom | Where to look first |
|---|---|
| TypeScript error / red squiggles | `npm run check` — read the full error, find the file:line |
| Visual / layout wrong | `chrome-devtools-mcp:chrome-devtools` — inspect element, check computed styles |
| White screen / page crash | `chrome-devtools-mcp:troubleshooting` — check console for errors |
| Data not showing / stale | Store not reactive? `loadData($auth)` missing in `onMount`? Check `data.ts` |
| Supabase returns empty | RLS policy — run `execute_sql` to check rows exist; confirm `auth.uid() = user_id` |
| Works in guest, broken when logged in | Auth mode difference — check `getAuthContext()` returns correct `mode` |
| Works on first load, breaks on nav | `onMount` not re-running — add `$: if ($auth.mode !== 'loading') loadData($auth)` |
| CSS token not applying | Missing token in one of the 5 theme blocks in `app.css` |

**Step 4 — Fix and verify**
1. Make the minimal change
2. `npm run check` — zero type errors
3. `verify` — confirm fix in browser, test the exact scenario from Step 1
4. `commit-commands:commit`

**Escalate after 2 real attempts**
A real attempt = you diagnosed the root cause, made a targeted fix, and tested it. If still broken after two of those → `superpowers:systematic-debugging`

### Stuck / Not Working — Escalate
> If something isn't resolved after 2 attempts, stop and invoke the skill.

→ `superpowers:systematic-debugging`

### When in Doubt — Ask First

Before making any non-obvious implementation call, stop and ask the user:

- Should this be a component or inline code?
- Should this string go in i18n (`en.ts`/`th.ts`) or be hardcoded?
- Should this logic live in `db.ts`, a store, or the page?
- Is this a new writable store or a derived from an existing one?
- Which nav group does this page belong to (Main / Track)?

One clarifying question is cheaper than a wrong implementation.

---

## Skill Routing

### SvelteKit — REQUIRED before writing code in these areas

| Situation | Skill |
|---|---|
| Page/layout architecture | `svelte-skills:sveltekit-structure` |
| Store design, reactivity, load functions | `svelte-skills:sveltekit-data-flow` |
| Building a new component | `svelte-skills:svelte-components` |
| CSS, scoped styles, theming | `svelte-skills:svelte-styling` |
| Svelte 5 runes (`$state`, `$derived`) | `svelte-skills:svelte-runes` |
| Template directives (`{#if}`, `{#each}`) | `svelte-skills:svelte-template-directives` |
| API routes, server-side logic | `svelte-skills:sveltekit-remote-functions` |
| Charts / data visualisation | `svelte-skills:svelte-layerchart` |
| Deployment config | `svelte-skills:svelte-deployment` |
| Choosing a library for a feature | `svelte-skills:ecosystem-guide` |

> **Always use `context7` MCP** when writing library-specific code (SvelteKit APIs, Supabase JS, Chart.js) — fetch current docs before writing, don't rely on training data.

### UI / Design / Animation

| Situation | Skill |
|---|---|
| Any visual design decision, layout, spacing | `ui-ux-pro-max:ui-ux-pro-max` |
| Theme tokens, palette, contrast ratios | `color-expert` |
| CSS keyframe animations, transitions | `css-animations` |
| Complex motion sequences | `animate` |
| Adding i18n strings to `en.ts` / `th.ts` | `better-i18n` |
| PWA: service worker, offline, install prompt | `pwa-expert` |

### Database

| Situation | Skill |
|---|---|
| Any Supabase feature (queries, auth, storage) | `supabase:supabase` |
| Schema change, new table, new column, index | `supabase:supabase-postgres-best-practices` |
| Read query / inspect data / debug | Use `mcp__plugin_supabase_supabase__execute_sql` directly (read-only) |

> **Rule:** Never touch schema without invoking `supabase:supabase-postgres-best-practices` first.

### Vercel / Deploy

| Situation | Skill |
|---|---|
| Deploy / check deployment status | `vercel:deploy` |
| Confirm live deploy is healthy | `vercel:verification` |
| Auth flow / Google OAuth | `vercel:auth` |
| Environment variables | `vercel:env` |

### Browser Debugging

| Situation | Skill |
|---|---|
| General in-browser debug | `chrome-devtools-mcp:chrome-devtools` |
| White screen / crash / console errors | `chrome-devtools-mcp:troubleshooting` |
| Accessibility audit | `chrome-devtools-mcp:a11y-debugging` |
| Slow page loads / LCP | `chrome-devtools-mcp:debug-optimize-lcp` |
| Memory leak (timer page especially) | `chrome-devtools-mcp:memory-leak-debugging` |

### Code Quality / Review

| Situation | Skill |
|---|---|
| Full diff review before PR | `code-review:code-review` |
| Cleanup after a big feature | `code-simplifier:code-simplifier` |
| Auth, RLS, input validation audit | `security-review` |
| Update this file after learning something | `claude-md-management:claude-md-improver` |

### Meta / Process

| Situation | Skill |
|---|---|
| Design a feature from scratch | `superpowers:brainstorming` |
| Write implementation plan | `superpowers:writing-plans` |
| Execute a plan file | `superpowers:subagent-driven-development` |
| Debug a bug (after 2 failed attempts) | `superpowers:systematic-debugging` |
| Verify feature works in browser | `verify` |
| Start dev server to test UI | `run` |
| Before marking any task done | `superpowers:verification-before-completion` |
| Finishing branch, pre-PR | `superpowers:finishing-a-development-branch` |
| Code review requested | `superpowers:requesting-code-review` |
| Review feedback received | `superpowers:receiving-code-review` |
| Two independent tasks at once | `superpowers:dispatching-parallel-agents` |
| Two features in parallel safely | `superpowers:using-git-worktrees` |
| Commit only | `commit-commands:commit` |
| Commit + push + open PR | `commit-commands:commit-push-pr` |
| Clean stale local branches | `commit-commands:clean_gone` |

---

## Recipes

Exact patterns for the four most repeated tasks. Follow these precisely — don't invent variations.

### New Page

0. Invoke `svelte-skills:sveltekit-structure` before creating the file
1. Create `src/routes/(app)/pagename/+page.svelte`
   - Import `onMount` from `'svelte'`
   - Import `auth` from `'$lib/stores/auth'`
   - Import `loadData` (+ any stores needed) from `'$lib/stores/data'`
   - Call `loadData($auth)` inside `onMount`
2. Add nav entry to `src/lib/components/Sidebar.svelte` groups array:
   ```ts
   { label: 'PageName', href: '/pagename', d: '<SVG path d string>' }
   ```
   - **Main group:** dashboard, timer, subjects
   - **Track group:** analytics, journey, tasks, schedule, scores
3. Add i18n key to **both** `src/lib/i18n/en.ts` and `src/lib/i18n/th.ts`

### New DB Feature

0. Invoke `supabase:supabase-postgres-best-practices` before touching any schema
1. **`src/lib/types.ts`** — add `interface MyThing { ... }` and any mapper types
2. **`src/lib/db.ts`** — add dual-mode methods (guest → `lsGet`, auth → supabase query + mapper)
3. **`src/lib/stores/data.ts`** — add `export const myThings = writable<MyThing[]>([])`, populate in `loadData()`
4. **Supabase migration** — invoke `supabase:supabase` skill, create table + RLS policy (`auth.uid() = user_id`)
5. **Page/component** — build the UI

### New Component

- Shared across features → `src/lib/components/ComponentName.svelte`
- Feature-specific (2+ components for same feature) → `src/lib/components/featurename/`
- Props: `export let propName: Type`
- Events: `createEventDispatcher<{ eventName: PayloadType }>()`
- No barrel `index.ts` files, no default exports

### New Setting

1. **`src/lib/stores/settings.ts`** — add field to `Settings` interface
2. **`src/lib/stores/settings.ts`** — add default value in `defaults()` function
   *(auto-persists to `localStorage` via the existing `subscribe` — no extra work needed)*
3. **`src/routes/(app)/settings/+page.svelte`** — add UI control in the relevant section

### Standard Empty State

Use this exact markup and CSS on every page that can have no data:

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

No loading spinners needed — stores start empty and fill fast from localStorage or Supabase. No explicit error states — db errors are caught silently in `db.ts`.

---

## Definition of Done

Before declaring any task complete, all steps must pass in order:

1. **`npm run check`** — zero type errors
2. **`verify` skill** (or `run` + manual browser check) — feature works visually in browser
3. **`superpowers:verification-before-completion`** — self-review checklist passes
4. **`code-review:code-review`** — review the diff, fix any findings
5. **`commit-commands:commit`** (or `commit-push-pr` if ready to push)
6. **If completing a plan:** move it from **Open → Completed** in the Active Plans section of this file and commit the change

---

## Pulse-Specific Gotchas

| Symptom | Cause & Fix |
|---|---|
| Store value stale / not reactive | Access via `$store` in templates, `.subscribe()` in scripts — never `.value` |
| Data not loading on page | Must call `loadData($auth)` in `onMount`, not module scope |
| New CSS token not working in some themes | All five theme blocks in `app.css` need the token — check all of them |
| Supabase query returns empty | RLS — all tables require `auth.uid() = user_id`; guest mode never hits Supabase |
| Type error in `db.ts` | DB returns `snake_case` — always add a mapper function, never use raw DB field names in components |
| Chart.js color wrong in dark mode | Read via `getComputedStyle(document.body).getPropertyValue('--primary').trim()` — use `document.body`, NOT `document.documentElement`. Theme classes are on `<body>`, so `:root` vars don't reflect the active theme. |
| Transition causes layout thrash | Never use `transition: width` or `transition: height` — use `transform: scaleX/scaleY` |
| `loadScheduleSlots` gets stale `_userId` | Must call `loadData($auth)` reactive BEFORE `loadScheduleSlots` reactive in file declaration order — `_userId` is set inside `loadData`, so ordering matters |
| CSS specificity beats `:global()` | Scoped Svelte styles `.class.svelte-xxx` (0,2,0) override `:global(.class)` (0,1,0) — use `!important` when a global rule must win |
| SVG `d` attribute can't contain HTML | Never embed `" /><polyline points="..."` inside a `d` string — Svelte HTML-encodes it. Use proper multi-subpath syntax with `M` commands instead |
| Text invisible on primary background in dark themes | Never use `color: white` or `color: #fff` on `background: var(--primary)` — use `color: var(--bg)` which is always the contrasting color regardless of theme |

> If a gotcha isn't resolved in 2 attempts → `superpowers:systematic-debugging`

---

## Stack

- **Framework:** SvelteKit 2, TypeScript
- **Backend:** Supabase JS v2 (PostgreSQL + Auth)
- **Styling:** Plain CSS with custom property tokens (no Tailwind)
- **Font:** Geist (Vercel), SF Pro (Apple), Inter (Resend) — loaded via `app.html`
- **Deploy:** Vercel, auto-deploy from `master`

---

## Project Structure

```
src/
  app.css                  # Global styles, design tokens, theme overrides
  lib/
    components/            # Shared UI components (Sidebar, HeroCard, etc.)
    stores/
      auth.ts              # Auth state (guest | authenticated | loading)
      data.ts              # All data stores + loadData()
      settings.ts          # Theme + study settings, persisted to localStorage
      timer.ts             # Timer state
    db.ts                  # Data access layer — routes to localStorage or Supabase
    types.ts               # All shared TypeScript types
    constants.ts           # TCAS_SUBJECTS and template definitions
    i18n/
      en.ts                # English strings
      th.ts                # Thai strings
    srs.ts                 # SM-2 spaced repetition algorithm
    supabase.ts            # Supabase client
  routes/
    (app)/                 # Main app layout (sidebar + content)
      dashboard/
      timer/
      subjects/
      tasks/
      analytics/
      schedule/
      scores/
      journey/
      insights/
      settings/
    auth/                  # Login / signup pages
    onboarding/            # (planned)
```

---

## CSS Token System

Never hardcode colors. Always use these CSS custom properties:

```css
--bg          /* page background */
--bg2         /* card / sidebar background */
--bg3         /* hover state */
--border      /* borders and dividers */
--text        /* primary text */
--muted       /* secondary text */
--primary     /* brand accent (varies by theme) */
--primary-dark
--primary-l   /* light tint of primary */
--primary-rgb /* r,g,b values for rgba() */
--nav-main    /* sidebar "Main" group label color */
--nav-track   /* sidebar "Track" group label color */
--radius-md   /* standard border radius */
--font-sans
--font-mono
```

For Chart.js colors, always read from computed style:
```js
getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
```

---

## Theme System

Five named themes stored as a single `theme` field in settings:

| Value | Design | Mode |
|-------|--------|------|
| `vercel-light` | Vercel | Light |
| `vercel-dark` | Vercel | Dark |
| `apple-light` | Apple | Light |
| `apple-dark` | Apple | Dark |
| `resend` | Resend | Always dark |

Body classes are set in `src/routes/+layout.svelte`:
- `design-vercel` / `design-apple` / `design-resend`
- `theme-dark` (when dark)

Theme CSS blocks live in `src/app.css`. Each design theme sets its own `--primary`, `--nav-main`, `--nav-track`, etc.

**Vercel:** ink black `#171717` primary (light), `#ededed` (dark)  
**Apple:** action blue `#0066cc` (light), sky blue `#2997ff` (dark)  
**Resend:** white `#fcfdff` on true black, always dark

---

## Data Layer (`src/lib/db.ts`)

Single `db` object. Every method takes `mode: 'guest' | 'authenticated'`:
- `guest` → reads/writes `localStorage` with `pulse_*` keys
- `authenticated` → reads/writes Supabase

Pattern:
```ts
async getSomething(userId: string, mode: Mode): Promise<Something[]> {
  if (mode === 'guest') return lsGet<Something>('pulse_something');
  const { data } = await supabase.from('something').select('*').eq('user_id', userId);
  return (data ?? []).map(mapSomethingFromDb);
}
```

DB column names are `snake_case`; TypeScript fields are `camelCase`. Always add a mapper function.

---

## Stores (`src/lib/stores/data.ts`)

```ts
subjects, topics, srsCards, sessions, tasks, scores, scheduleSlots  // writables
todaysSessions, dueCards, todayHours, streak, tasksDueToday          // derived
loadData(authState)   // call on page mount to populate all stores
getAuthContext()      // returns { userId, mode } for db calls
```

Always call `loadData($auth)` in `onMount` on pages that need data.

---

## Auth (`src/lib/stores/auth.ts`)

```ts
type AuthState =
  | { mode: 'loading' }
  | { mode: 'guest';         user: null;      name: string }
  | { mode: 'authenticated'; user: User;      name: string }
```

Guest mode works fully offline with localStorage. No account required.

---

## Supabase Tables

| Table | Notes |
|-------|-------|
| `subjects` | Per-user subjects |
| `topics` | Belong to a subject |
| `srs_cards` | One per topic, SM-2 state |
| `study_sessions` | Timer sessions |
| `tasks` | Tasks with priority/due date |
| `templates` | User custom templates (planned) |

All tables have RLS enabled. Policy: `auth.uid() = user_id`.

---

## Coding Rules

- **No hardcoded hex colors** — always use CSS vars or `getComputedStyle`
- **No `transition: width/height`** — causes layout thrash. Use `transform: scaleX/scaleY`
- **No comments** unless the WHY is non-obvious
- **No extra features** beyond what's asked — YAGNI
- **Follow existing patterns** — db methods, store structure, component style

---

## Design References

- `docs/design/vercel.md` — Vercel design language
- `docs/design/apple.md` — Apple design language
- `docs/design/resend.md` — Resend design language

---

## Active Plans

> **Rule:** When a plan is fully implemented and committed, move it from Open → Completed here, then commit this file. Never leave a finished plan in the Open list.

### Open (ready to implement)

- `docs/superpowers/plans/2026-05-28-exam-simulation.md` — Exam Simulation (readiness score card, question bank, mock exam with timer modes)

### Completed

- `docs/superpowers/plans/2026-05-26-templates-with-topics.md` — Templates with topic presets
- `docs/superpowers/plans/2026-05-26-google-oauth.md` — Google OAuth login (implicit flow; PKCE upgrade pending @supabase/ssr migration)
- `docs/superpowers/plans/2026-05-28-stronger-base-design.md` — Token system, ESLint/Stylelint, component decomposition, authCtx derived store, Playwright smoke tests
- `docs/superpowers/plans/2026-05-26-journey.md` — Journey page: stat cards, 16-week heatmap, session timeline
- `docs/superpowers/plans/2026-05-26-scores.md` — Scores tracking page
- `docs/superpowers/plans/2026-05-26-quick-fixes.md` — Sidebar gap, delete confirms, scroll fix, dark mode contrast
- `docs/superpowers/plans/2026-05-26-srs-review.md` — SRS flashcard review page (queue, ratings, summary, keyboard shortcuts)
- `docs/superpowers/plans/2026-05-26-calendar-phase2.md` — Auto-schedule algorithm, load bars, school-hours shading, right sidebar, exam countdown
- `docs/superpowers/plans/2026-05-25-calendar-phase1.md` — Calendar Phase 1 (drag/drop week grid)
- `docs/superpowers/plans/2026-05-25-auth-onboarding.md` — Auth + onboarding fix
- `docs/superpowers/plans/2026-05-24-pulse-plan-3a-tasks.md` — Tasks feature
