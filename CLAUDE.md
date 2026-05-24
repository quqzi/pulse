# Pulse — CLAUDE.md

Study tracker app for TCAS exam prep. SvelteKit 2 + TypeScript + Supabase, deployed to Vercel.

**Repo:** https://github.com/quqzi/pulse  
**Live:** https://pulse-hazel-ten.vercel.app  
**Branch:** `master` (auto-deploys to Vercel on push)

---

## Stack

- **Framework:** SvelteKit 2, TypeScript
- **Backend:** Supabase JS v2 (PostgreSQL + Auth)
- **Styling:** Plain CSS with custom property tokens (no Tailwind)
- **Font:** Geist (Vercel), SF Pro (Apple), Inter (Resend) — loaded via app.html
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

## Coding Rules

- **No hardcoded hex colors** — always use CSS vars or `getComputedStyle`
- **No `transition: width/height`** — causes layout thrash. Use `transform: scaleX/scaleY`
- **No comments** unless the WHY is non-obvious
- **No extra features** beyond what's asked — YAGNI
- **Follow existing patterns** — db methods, store structure, component style

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

## Design References

Detailed design token specs for the three supported themes:

- `docs/design/vercel.md` — Vercel design language (ink black, Geist font, mesh gradient)
- `docs/design/apple.md` — Apple design language (Action Blue, SF Pro, photography-first)
- `docs/design/resend.md` — Resend design language (true black canvas, Domaine Display serif, atmospheric glows)

---

## Active Plans & Specs

- `docs/superpowers/specs/2026-05-24-subject-management-design.md` — subject + template management (planned, not yet implemented)
- `docs/superpowers/plans/2026-05-24-pulse-plan-3a-tasks.md` — Tasks feature (completed)
