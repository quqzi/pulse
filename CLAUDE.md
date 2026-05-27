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

## Claude's Role

Claude is the primary full-stack developer on this project. Every feature goes through a deliberate workflow. Pick the right tier based on scope:

### New Feature / New Page — Full Chain
> Anything that touches multiple files, adds a route, or changes data flow.

1. `superpowers:brainstorming` — design + spec
2. `superpowers:writing-plans` — write plan to `docs/superpowers/plans/`
3. `superpowers:subagent-driven-development` — execute plan task-by-task
4. `verify` or `run` — confirm it works in browser
5. `superpowers:verification-before-completion` — self-review checklist
6. `commit-commands:commit-push-pr` — commit, push, open PR

### Small Fix / Tweak — Skip Design
> Single-file changes, CSS fixes, copy edits, bug patches.

1. Implement directly
2. `npm run check` — zero type errors
3. `verify` — confirm fix in browser
4. `commit-commands:commit` — commit

### Stuck / Not Working — Escalate
> If something isn't resolved after 2 attempts, stop and invoke the skill.

→ `superpowers:systematic-debugging`

---

## Skill Routing

### SvelteKit — Use These First

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

## Definition of Done

Before declaring any task complete, all four must pass:

1. **`npm run check`** — zero type errors
2. **`verify` skill** (or `run` + manual browser check) — feature works visually in browser
3. **`superpowers:verification-before-completion`** — self-review checklist passes
4. **`commit-commands:commit`** (or `commit-push-pr` if ready to push)

---

## Pulse-Specific Gotchas

| Symptom | Cause & Fix |
|---|---|
| Store value stale / not reactive | Access via `$store` in templates, `.subscribe()` in scripts — never `.value` |
| Data not loading on page | Must call `loadData($auth)` in `onMount`, not module scope |
| New CSS token not working in some themes | All five theme blocks in `app.css` need the token — check all of them |
| Supabase query returns empty | RLS — all tables require `auth.uid() = user_id`; guest mode never hits Supabase |
| Type error in `db.ts` | DB returns `snake_case` — always add a mapper function, never use raw DB field names in components |
| Chart.js color wrong in dark mode | Read via `getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()` — never hardcode |
| Transition causes layout thrash | Never use `transition: width` or `transition: height` — use `transform: scaleX/scaleY` |

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
subjects, topics, srsCards, sessions, tasks  // writables
todaysSessions, dueCards, todayHours, streak, tasksDueToday  // derived
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

### Open (ready to implement)

- `docs/superpowers/plans/2026-05-26-calendar-phase2.md` — Auto-schedule algorithm, load bars, school-hours shading, right sidebar, exam countdown
- `docs/superpowers/plans/2026-05-26-journey.md` — Journey page: stat cards, 16-week heatmap, session timeline
- `docs/superpowers/plans/2026-05-26-srs-review.md` — SRS flashcard review page
- `docs/superpowers/plans/2026-05-26-google-oauth.md` — Google OAuth login
- `docs/superpowers/plans/2026-05-26-templates-with-topics.md` — Templates with topic presets

### Completed

- `docs/superpowers/plans/2026-05-26-scores.md` — Scores tracking page
- `docs/superpowers/plans/2026-05-26-journey.md` — Journey page with heatmap
- `docs/superpowers/plans/2026-05-26-quick-fixes.md` — Sidebar gap, delete confirms, scroll fix, dark mode contrast
- `docs/superpowers/plans/2026-05-25-calendar-phase1.md` — Calendar Phase 1 (drag/drop week grid)
- `docs/superpowers/plans/2026-05-25-auth-onboarding.md` — Auth + onboarding fix
- `docs/superpowers/plans/2026-05-24-pulse-plan-3a-tasks.md` — Tasks feature
