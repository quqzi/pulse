# Stronger Base — Design Spec
_2026-05-27_

## Problem

The codebase has accumulated structural debt that makes every bug fix expensive:
- 34 hardcoded hex colors that reappear after every new component
- No linting — nothing prevents new bad patterns from entering
- Files over 800 lines where fixing one thing requires reading everything
- A module-level singleton for auth context that already caused one production bug
- Zero automated tests — regressions caught only by eye

This spec defines 5 sequential improvements that harden the foundation before new features are built.

---

## Approach

Foundation-first, lowest-risk-first:

1. **Token system** — eliminate all hardcoded colors, add missing semantic tokens
2. **Linting** — lock in the token system with enforcement
3. **File decomposition** — break large files into focused units
4. **Data layer** — fix the auth context singleton, simplify guest/auth branching
5. **Testing** — Playwright smoke tests for the 6 most-broken paths

Each step is a standalone, safe change. Steps 1+2 prevent the color bug class permanently. Steps 3+4 make future features cheaper. Step 5 catches regressions automatically.

---

## Section 1 — Token System

### New tokens (added to all 5 theme blocks in `app.css`)

```css
--warning: #f59e0b;       /* amber — overdue, urgent states */
--success: #22c55e;       /* green — reviewed, complete states */
--danger-soft: #fef2f2;   /* light red background for error boxes */
--success-soft: #f0fdf4;  /* light green background */
```

### Global fix in `app.css`

```css
/* Before */
.btn-primary { color: #fff; }

/* After */
.btn-primary { color: var(--bg); }
```

### Sweep across all `.svelte` files

| Hardcoded value | Replace with |
|---|---|
| `#ef4444` | `var(--danger)` |
| `#dc2626` | `var(--danger)` |
| `#22c55e` | `var(--success)` |
| `#f59e0b` | `var(--warning)` |
| `color: white` / `color: #fff` on primary backgrounds | `var(--bg)` |
| `stroke="white"` on SVG icons | `stroke="currentColor"` |
| Auth error box (`background:#fef2f2; color:#dc2626`) | `var(--danger-soft)` / `var(--danger)` |
| `color: #fff` in `btn-ctrl` (timer) | `var(--bg)` |
| `color: #ffffff` on subject tiles | `var(--bg)` |

**Affected files:** `app.css`, `analytics/+page.svelte`, `dashboard/+page.svelte`, `scores/+page.svelte`, `subjects/+page.svelte`, `subjects/[id]/+page.svelte`, `tasks/+page.svelte`, `timer/+page.svelte`, `settings/+page.svelte`, `auth/login/+page.svelte`, `auth/signup/+page.svelte`, `scores/ScoreForm.svelte`

**Constraint:** Zero behavior change. Pure token substitution.

---

## Section 2 — Linting

### Stylelint (CSS enforcement)

**Install:**
```
stylelint stylelint-config-standard
```

**Config (`stylelint.config.js`):**
```js
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-invalid-hex': true,
    'color-named': 'never',          // ban 'white', 'black', 'red' etc.
    'declaration-property-value-disallowed-list': {
      'color': ['/^#/'],             // ban hex in color property
      'background': ['/^#/'],        // ban hex in background
      'background-color': ['/^#/'],
      'border-color': ['/^#/'],
    },
  },
  ignoreFiles: ['node_modules/**', '.svelte-kit/**'],
};
```

**Exceptions:** Theme definition blocks in `app.css` are exempt (they define the tokens, they don't consume them). Achieved via `/* stylelint-disable */` blocks around the theme variable definitions only.

### ESLint (TypeScript/Svelte enforcement)

**Install:**
```
eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-svelte
```

**Rules:**
- `@typescript-eslint/no-explicit-any` — warn (not error, Chart.js still uses `any`)
- `@typescript-eslint/no-unused-vars` — error
- `no-console` — error (prevents debug logs in production)

### Scripts in `package.json`

```json
"lint:css": "stylelint \"src/**/*.{css,svelte}\"",
"lint:js": "eslint \"src/**/*.{ts,svelte}\"",
"lint": "npm run lint:css && npm run lint:js",
"check:all": "npm run check && npm run lint"
```

**Updated definition of done:** `npm run check:all` (not just `npm run check`) before every commit.

---

## Section 3 — File Decomposition

### WeekGrid.svelte (811 lines → ~200 lines + 3 extracted modules)

**Extract to `src/lib/components/calendar/weekgrid/`:**

| File | Responsibility | Est. lines |
|---|---|---|
| `timeUtils.ts` | `snap()`, `toLocalISO()`, `slotStyle()`, `formatHour()`, `getGridYFromClientY()`, `getDayIdxFromClientX()` | ~50 |
| `useDrag.ts` | Mouse drag state and handlers: `onDayMousedown`, `onMousemove`, `onMouseup`, `onBlockDragStart`, `onBlockResizeStart` | ~120 |
| `useTouch.ts` | Long-press touch state and handlers: `onDayTouchstart`, `onHoldMoveCancel`, `onTouchmove`, `onTouchend`, `clearHoldTimer` | ~80 |

`WeekGrid.svelte` becomes a layout/render file that imports these modules and wires them to the template.

### db.ts (515 lines → 6 domain files + 1 index)

**Extract to `src/lib/db/`:**

| File | Contents |
|---|---|
| `_core.ts` | `lsGet`, `lsSet`, `newId`, `today`, `read` adapter helper |
| `subjects.ts` | `getSubjects`, `saveSubject`, `deleteSubject`, mappers |
| `topics.ts` | `getTopic`, `saveTopic`, `deleteTopic`, `updateSrsCard`, mappers |
| `sessions.ts` | `getSessions`, `logSession`, `updateSession`, mappers |
| `tasks.ts` | `getTasks`, `saveTask`, `deleteTask`, mappers |
| `schedule.ts` | `getScheduleSlots`, `saveScheduleSlot`, `deleteScheduleSlot`, etc. |
| `scores.ts` | `getScores`, `saveScore`, `deleteScore`, mappers |
| `index.ts` | Re-exports as same `db` object — zero changes to callers |

**The `read` adapter helper (cuts per-method boilerplate in half):**
```ts
function read<T>(key: string, query: () => Promise<T[]>, mode: Mode): Promise<T[]> {
  return mode === 'guest' ? Promise.resolve(lsGet<T>(key)) : query();
}
```

### tasks/+page.svelte (522 lines → 3 files)

| File | Responsibility |
|---|---|
| `+page.svelte` | Page layout, filter state, data loading (~150 lines) |
| `lib/components/tasks/TaskItem.svelte` | Single task row: display, inline edit, complete, delete |
| `lib/components/tasks/TaskForm.svelte` | Add-task form with subject picker, priority, due date |

### analytics/+page.svelte (462 lines → 2 files)

| File | Responsibility |
|---|---|
| `+page.svelte` | Stat cards, SRS breakdown, subject breakdown (~200 lines) |
| `lib/components/analytics/StudyTrendChart.svelte` | Chart.js bar chart, self-contained theme reactivity |

**Constraint:** All splits are pure refactors. Zero behavior change. All component interfaces and store imports stay identical.

---

## Section 4 — Data Layer

### Problem

`_userId` and `_mode` in `data.ts` are module-level mutable variables. They're set inside `loadData()` and read by `getAuthContext()` and `loadScheduleSlots()`. If anything reads them before `loadData()` runs, it silently gets stale `'guest'` values — already caused one production bug.

### Fix — replace singleton with derived store

```ts
// data.ts
import { derived } from 'svelte/store';
import { auth } from '$lib/stores/auth';

export const authCtx = derived(auth, ($auth) => ({
  userId: $auth.mode === 'authenticated' ? ($auth.user?.id ?? '') : 'guest',
  mode: $auth.mode === 'loading' ? 'guest' : $auth.mode,
} as { userId: string; mode: 'guest' | 'authenticated' }));
```

`getAuthContext()` becomes a synchronous read of the store value (using `get(authCtx)`). No ordering dependency — the value is always derived from the live auth state.

`loadScheduleSlots` reads `get(authCtx)` directly instead of relying on `_userId`/`_mode` being set first. The schedule page no longer needs the ordering workaround.

### Guest/auth adapter

Moves into `db/_core.ts`:

```ts
export function read<T>(key: string, query: () => Promise<T[]>, mode: Mode): Promise<T[]> {
  return mode === 'guest' ? Promise.resolve(lsGet<T>(key)) : query();
}

export function write<T>(key: string, item: T, update: () => Promise<void>, mode: Mode): Promise<void> {
  if (mode === 'guest') { /* lsSet logic */ return Promise.resolve(); }
  return update();
}
```

Each db method uses `read`/`write` instead of repeating the `if (mode === 'guest')` branch. New features require ~5 lines per method instead of ~15.

**Affected files:** `data.ts`, `db/_core.ts`, `schedule/+page.svelte` (remove ordering workaround), all `db/*.ts` files (use adapter).

---

## Section 5 — Testing

### Tool

Playwright — partially configured in `.playwright-mcp/`. Needs `playwright.config.ts` and test files under `tests/`.

### The 6 smoke tests

| Test file | Flow tested | Regression it catches |
|---|---|---|
| `tests/guest-dashboard.spec.ts` | App loads in guest mode, dashboard shows | Blank page on refresh, auth timing |
| `tests/timer.spec.ts` | Select subject → Start → Stop → session summary appears | Timer store, session save |
| `tests/subjects.spec.ts` | Add subject → appears in list | Store update, localStorage write |
| `tests/schedule.spec.ts` | Navigate to schedule, hard-refresh, week grid loads | `_userId` ordering bug class |
| `tests/analytics-themes.spec.ts` | Switch to dark theme → chart renders with light axis labels | Chart.js color reactivity |
| `tests/tasks.spec.ts` | Add task → mark complete → disappears from active list | Task CRUD, filter logic |

### Config

```ts
// playwright.config.ts
export default {
  testDir: './tests',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
};
```

### Scripts

```json
"test": "playwright test",
"test:ui": "playwright test --ui"
```

### Scope

Guest-mode only (no Supabase credentials in test environment). Auth flows are excluded. 6 tests is the target — not full coverage, just the safety net for the paths that break most often.

---

## Execution Order

| Phase | What | Risk | Duration estimate |
|---|---|---|---|
| 1 | Token system sweep | None — pure substitution | 1 session |
| 2 | Linting setup | None — additive | 1 session |
| 3 | File decomposition | Low — pure refactor | 2–3 sessions |
| 4 | Data layer refactor | Medium — touches all pages | 1–2 sessions |
| 5 | Playwright smoke tests | None — additive | 1 session |

Each phase ships as its own commit set. New features can begin after Phase 2 (linting locked in), and Phase 3–5 can run alongside feature work.

---

## Definition of Done

- `npm run check:all` passes (zero type errors, zero lint errors)
- No hardcoded hex colors remain in any `.svelte` or `.css` file (outside theme token definitions)
- No file in `src/` exceeds 350 lines
- `getAuthContext()` never returns stale data regardless of call order
- `npm run test` passes all 6 smoke tests in guest mode
