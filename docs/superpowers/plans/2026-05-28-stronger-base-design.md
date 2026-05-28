# Stronger Base Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Pulse codebase foundation — eliminate hardcoded colors, add linting enforcement, decompose oversized files, fix the auth-context singleton bug, and add Playwright smoke tests.

**Architecture:** Five sequential phases, each independently shippable. Phases 1–2 are pure additions (zero behavior change). Phases 3–4 are refactors verified by `npm run check`. Phase 5 adds a new test layer. WeekGrid.svelte decomposition is intentionally deferred — it has the most complex drag/touch interaction and should only be split after tests are in place.

**Tech Stack:** SvelteKit 2, TypeScript, Svelte 5, ESLint, Stylelint, Playwright

**Known gap:** WeekGrid.svelte (735 lines) exceeds the 350-line target but is excluded from Phase 3 — its drag/touch machinery is too risky to split without existing test coverage. It becomes a candidate after Phase 5 tests are green.

---

## File Map

| Phase | Files Created | Files Modified |
|---|---|---|
| 1 Token | — | `src/app.css`, 14 `.svelte` files |
| 2 Lint | `.eslintrc.cjs`, `stylelint.config.js` | `package.json`, `src/app.css` |
| 3 Decomp | `src/lib/components/tasks/TaskItem.svelte`, `TaskForm.svelte`, `src/lib/components/analytics/StudyTrendChart.svelte` | `src/routes/(app)/tasks/+page.svelte`, `src/routes/(app)/analytics/+page.svelte` |
| 4 Data | — | `src/lib/stores/data.ts`, `src/routes/(app)/schedule/+page.svelte` |
| 5 Tests | `playwright.config.ts`, `tests/guest-dashboard.spec.ts`, `tests/timer.spec.ts`, `tests/subjects.spec.ts`, `tests/schedule.spec.ts` | `package.json` |

---

## Phase 1 — Token System

### Task 1: Add semantic tokens to all theme blocks in app.css

**Files:**
- Modify: `src/app.css`

The four tokens must appear in ALL five theme blocks: `body, body.design-vercel`, `body.design-vercel.theme-dark`, `body.design-apple`, `body.design-apple.theme-dark`, `body.design-resend`.

- [ ] **Step 1: Add tokens to Vercel light block** (inside `body, body.design-vercel { ... }`, after `--srs-easy`)

```css
  --warning:      #f59e0b;
  --success:      #22c55e;
  --danger-soft:  #fef2f2;
  --success-soft: #f0fdf4;
```

- [ ] **Step 2: Add tokens to Vercel dark block** (inside `body.design-vercel.theme-dark { ... }`)

```css
  --warning:      #fbbf24;
  --success:      #4ade80;
  --danger-soft:  #2d1515;
  --success-soft: #0f2d1a;
```

- [ ] **Step 3: Add tokens to Apple light block** (inside `body.design-apple { ... }`, after `--srs-easy`)

```css
  --warning:      #f59e0b;
  --success:      #22c55e;
  --danger-soft:  #fef2f2;
  --success-soft: #f0fdf4;
```

- [ ] **Step 4: Add tokens to Apple dark block** (inside `body.design-apple.theme-dark { ... }`)

```css
  --warning:      #fbbf24;
  --success:      #4ade80;
  --danger-soft:  #2d1515;
  --success-soft: #0f2d1a;
```

- [ ] **Step 5: Add tokens to Resend block** (inside `body.design-resend, body.design-resend.theme-dark { ... }`)

```css
  --warning:      #fbbf24;
  --success:      #4ade80;
  --danger-soft:  #1a0808;
  --success-soft: #081a0e;
```

- [ ] **Step 6: Verify type-check passes**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 7: Commit**

```
git add src/app.css
git commit -m "feat: add --warning, --success, --danger-soft, --success-soft tokens to all themes"
```

---

### Task 2: Sweep hardcoded colors in svelte files — danger/warning/success

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`
- Modify: `src/routes/onboarding/+page.svelte`
- Modify: `src/routes/(app)/analytics/+page.svelte`
- Modify: `src/routes/(app)/tasks/+page.svelte`
- Modify: `src/routes/(app)/subjects/[id]/+page.svelte`
- Modify: `src/lib/components/scores/ScoreForm.svelte`
- Modify: `src/lib/components/calendar/ExamBanner.svelte`

**Rule:** Replace occurrences that are *consuming* a color value (not defining a new variable). Theme token definitions in `app.css` are exempt.

- [ ] **Step 1: Fix `dashboard/+page.svelte` line ~191**

Find: `color: #ef4444; font-weight: 600; }`
Replace: `color: var(--danger); font-weight: 600; }`

- [ ] **Step 2: Fix `onboarding/+page.svelte` line ~212**

Find: `.save-error { color: #dc2626;`
Replace: `.save-error { color: var(--danger);`

- [ ] **Step 3: Fix `analytics/+page.svelte` — two urgent/warning occurrences (~lines 375, 422)**

Find: `color: #f59e0b; }` (both occurrences in `.stat-value.urgent` and `.srs-due.has-due`)
Replace: `color: var(--warning); }` (both)

Also find: `color: var(--danger, #ef4444) !important;` in `.danger-btn:hover`
Replace: `color: var(--danger) !important;`

- [ ] **Step 4: Fix `tasks/+page.svelte` — four occurrences (~lines 386, 387, 408, 416)**

Find:
```css
.title-input.error { color: #ef4444; }
.title-input.error::placeholder { color: #ef4444; }
```
Replace:
```css
.title-input.error { color: var(--danger); }
.title-input.error::placeholder { color: var(--danger); }
```

Find: `.task-item.overdue { border-color: #ef444433; }`
Replace: `.task-item.overdue { border-color: rgba(var(--danger-rgb, 239,68,68), 0.2); }`

Find: `.due-label.overdue-label { color: #ef4444; font-weight: 600; }`
Replace: `.due-label.overdue-label { color: var(--danger); font-weight: 600; }`

- [ ] **Step 5: Fix `tasks/+page.svelte` — priority color variables (~lines 513–514)**

Find:
```css
    --priority-high: #ef4444;
    --priority-med:  #f59e0b;
```
Replace:
```css
    --priority-high: var(--danger);
    --priority-med:  var(--warning);
```

- [ ] **Step 6: Fix `subjects/[id]/+page.svelte` — SRS rating object and status colors (~lines 117, 281–282, 306)**

The object at line ~117 uses SRS rating colors. These already have CSS tokens (`--srs-again`, `--srs-hard`, `--srs-good`, `--srs-easy`). Change to use JavaScript variables derived from CSS custom properties, or switch from the inline color map to the CSS tokens directly. The simplest fix is replacing the inline object:

Find:
```svelte
{@const colors = {1:'#ef4444',2:'#f97316',3:'#22c55e',4:'#3b82f6'}}
```
Replace:
```svelte
{@const colors = {1:'var(--srs-again)',2:'var(--srs-hard)',3:'var(--srs-good)',4:'var(--srs-easy)'}}
```

Find: `.srs-status.due { color: #ef4444; }`
Replace: `.srs-status.due { color: var(--danger); }`

Find: `.srs-status.reviewed { color: #22c55e; }`
Replace: `.srs-status.reviewed { color: var(--success); }`

Find: `.del-btn:hover { background: var(--bg3); color: #ef4444; }`
Replace: `.del-btn:hover { background: var(--bg3); color: var(--danger); }`

- [ ] **Step 7: Fix `scores/ScoreForm.svelte` (~line 136)**

Find: `.score-inputs.error .field-input { border-color: #ef4444; }`
Replace: `.score-inputs.error .field-input { border-color: var(--danger); }`

- [ ] **Step 8: Fix `ExamBanner.svelte` (~line 20) — JS urgentColor**

Find:
```ts
$: urgentColor = daysLeft <= 14 ? '#f59e0b' : 'var(--primary)';
```
Replace:
```ts
$: urgentColor = daysLeft <= 14 ? 'var(--warning)' : 'var(--primary)';
```

- [ ] **Step 9: Verify**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 10: Commit**

```
git add src/routes src/lib
git commit -m "fix: replace hardcoded danger/warning/success hex colors with CSS tokens"
```

---

### Task 3: Fix auth error boxes and subject tile colors

**Files:**
- Modify: `src/routes/auth/login/+page.svelte`
- Modify: `src/routes/auth/signup/+page.svelte`
- Modify: `src/routes/(app)/subjects/+page.svelte`
- Modify: `src/routes/(app)/scores/+page.svelte`
- Modify: `src/routes/(app)/settings/+page.svelte`

- [ ] **Step 1: Fix auth error boxes — login and signup (same pattern in both files, ~line 67 and ~line 61)**

In `login/+page.svelte` find:
```css
.error-msg { background:#fef2f2; color:#dc2626; border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
```
Replace:
```css
.error-msg { background:var(--danger-soft); color:var(--danger); border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
```

Apply the identical change in `signup/+page.svelte`.

- [ ] **Step 2: Fix SVG `stroke="white"` in login and signup (~line 34 in login, ~line 23 in signup)**

In both files find: `stroke="white"`
Replace: `stroke="currentColor"`

- [ ] **Step 3: Fix subjects page — topic count badge white text (~line 221) and delete button (~line 264)**

Find: `color: #ffffff; font-size: 11px; font-weight: 700;`
Replace: `color: var(--bg); font-size: 11px; font-weight: 700;`

Find: `background: #fee2e2; color: #dc2626; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;`
Replace: `background: var(--danger-soft); color: var(--danger); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;`

- [ ] **Step 4: Fix `subjects/[id]/+page.svelte` — subject header white text (~line 402)**

Read the context around line 402 to identify the rule (it will be on a colored subject background — use `color: var(--bg)` there since `--bg` is always the page background).

Find: `color: #fff;` (in the subject header/hero section)
Replace: `color: var(--bg);`

- [ ] **Step 5: Fix `scores/+page.svelte` — white text on primary score badge (~line 229)**

Read context around line 229. If it's on `background: var(--primary)`, replace `color: #fff` with `color: var(--bg)`.

Find: `color: #fff;` (in score badge context — line ~229)
Replace: `color: var(--bg);`

Find: `.action-btn.danger:hover { color: #ef4444; }` (~line 273)
Replace: `.action-btn.danger:hover { color: var(--danger); }`

- [ ] **Step 6: Fix `settings/+page.svelte` — sign-out red text (~line 173)**

Find: `<span style="color:#dc2626;font-size:15px">Sign out</span>`
Replace: `<span style="color:var(--danger);font-size:15px">Sign out</span>`

- [ ] **Step 7: Fix `timer/+page.svelte` — btn-ctrl white text (~line 283)**

Find: `.btn-ctrl { background: var(--primary); color: #fff; }`
Replace: `.btn-ctrl { background: var(--primary); color: var(--bg); }`

- [ ] **Step 8: Fix `ConfirmDialog.svelte` — fallback hex in danger button (~line 89)**

Find: `.btn-confirm.danger { background: var(--danger, #ef4444); }`
Replace: `.btn-confirm.danger { background: var(--danger); }`

- [ ] **Step 9: Verify**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 10: Commit**

```
git add src/routes src/lib
git commit -m "fix: replace remaining hardcoded hex colors — auth errors, subject tiles, score badge, timer"
```

---

## Phase 2 — Linting

### Task 4: Install and configure ESLint

**Files:**
- Create: `.eslintrc.cjs`
- Modify: `package.json`

- [ ] **Step 1: Install ESLint packages**

```
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-svelte
```

- [ ] **Step 2: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:svelte/recommended',
  ],
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte'],
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'error',
  },
  ignorePatterns: ['node_modules/', '.svelte-kit/', 'build/'],
};
```

- [ ] **Step 3: Add lint:js script to `package.json`**

Add inside the `"scripts"` object:
```json
"lint:js": "eslint \"src/**/*.{ts,svelte}\""
```

- [ ] **Step 4: Run ESLint and fix any errors**

```
npm run lint:js
```

Fix any `no-console` errors by removing `console.log` / `console.error` calls (or prefixing variables with `_` for unused-var warnings). `@typescript-eslint/no-explicit-any` is warn-only so those can stay for now (Chart.js uses any).

- [ ] **Step 5: Commit**

```
git add .eslintrc.cjs package.json package-lock.json src/
git commit -m "feat: add ESLint with TypeScript + Svelte rules"
```

---

### Task 5: Install and configure Stylelint

**Files:**
- Create: `stylelint.config.js`
- Modify: `src/app.css` (add disable comments around theme token definitions)
- Modify: `package.json`

- [ ] **Step 1: Install Stylelint packages**

```
npm install -D stylelint stylelint-config-standard
```

- [ ] **Step 2: Create `stylelint.config.js`**

```js
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-invalid-hex': true,
    'color-named': 'never',
    'declaration-property-value-disallowed-list': {
      'color': ['/^#/'],
      'background': ['/^#(?!0000|fff|000)[0-9a-fA-F]/'],
      'background-color': ['/^#/'],
      'border-color': ['/^#/'],
    },
  },
  ignoreFiles: ['node_modules/**', '.svelte-kit/**', 'build/**'],
};
```

Note: the `background` pattern allows `#000000`/`#fff`/`#000` in Resend/Vercel design-specific button overrides since those are intentional theme-locked values. A simpler approach if this causes friction: wrap each design-signature block in `/* stylelint-disable */` / `/* stylelint-enable */`.

- [ ] **Step 3: Add disable comments around theme variable definitions in `app.css`**

The `--primary: #171717` style definitions in `:root` and each `body.design-*` block DEFINE tokens — they should not be flagged. Wrap the `:root` block and each design-specific block:

At the start of each design theme section comment add:
```css
/* stylelint-disable color-named, declaration-property-value-disallowed-list */
```
At the end of each design theme block close (before the next `/* ====` divider):
```css
/* stylelint-enable color-named, declaration-property-value-disallowed-list */
```

Also add `/* stylelint-disable-line declaration-property-value-disallowed-list */` on these intentional exceptions in `app.css`:
- `.hero-card { color: #fff; }` — always on a colored gradient, never on `--primary`
- `.hero-card::after { background: linear-gradient(...rgba(255,255,255,.18)...) }` — gradient overlay
- Subject color definitions in `:root` (they define fixed subject palette, not semantic UI colors)

- [ ] **Step 4: Add lint:css script to `package.json`**

```json
"lint:css": "stylelint \"src/**/*.{css,svelte}\"",
"lint": "npm run lint:css && npm run lint:js",
"check:all": "npm run check && npm run lint"
```

- [ ] **Step 5: Run Stylelint and fix remaining issues**

```
npm run lint:css
```

Review each violation. For intentional exceptions (gradient backgrounds, the Vercel/Resend signature button styles that use locked hex values), add `/* stylelint-disable-line */`. For anything that should use a token, switch it to the token.

- [ ] **Step 6: Verify full check passes**

```
npm run check:all
```

Expected: zero errors, zero warnings (or only known `no-explicit-any` warnings from Chart.js).

- [ ] **Step 7: Commit**

```
git add stylelint.config.js package.json package-lock.json src/app.css
git commit -m "feat: add Stylelint CSS enforcement — ban hardcoded hex in component styles"
```

---

## Phase 3 — File Decomposition

### Task 6: Extract StudyTrendChart from analytics page

**Files:**
- Create: `src/lib/components/analytics/StudyTrendChart.svelte`
- Modify: `src/routes/(app)/analytics/+page.svelte`

The Chart.js bar chart currently lives inline in the analytics page. It is self-contained: it needs the `sessions` store and handles its own theme reactivity. Extracting it makes the analytics page readable.

- [ ] **Step 1: Read the full analytics page to locate the chart block**

Read `src/routes/(app)/analytics/+page.svelte` and identify:
- The `<canvas>` element and its wrapping `<div>`
- The `onMount` / `afterUpdate` / `$:` blocks that manage the Chart.js instance
- The chart-specific CSS rules (axis colors, canvas sizing)

- [ ] **Step 2: Create `src/lib/components/analytics/StudyTrendChart.svelte`**

The component should:
- Import `sessions` from `'$lib/stores/data'`
- Contain all Chart.js logic (import, create, update, destroy in `onDestroy`)
- Read CSS vars via `getComputedStyle(document.body)` for theme reactivity
- Export no props (it reads the store directly)
- Own its CSS (canvas sizing, container)

Scaffold:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { sessions } from '$lib/stores/data';
  import type { Chart } from 'chart.js';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // [move all chart logic from analytics page here]

  onDestroy(() => chart?.destroy());
</script>

<div class="chart-wrap">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  /* [move chart-specific CSS here] */
</style>
```

- [ ] **Step 3: Update `analytics/+page.svelte` to import and use the component**

Remove the chart canvas, chart script logic, and chart CSS from the analytics page.
Add at the top of `<script>`:
```ts
import StudyTrendChart from '$lib/components/analytics/StudyTrendChart.svelte';
```

Replace the chart canvas section in the template with:
```svelte
<StudyTrendChart />
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/lib/components/analytics/StudyTrendChart.svelte src/routes
git commit -m "refactor: extract StudyTrendChart component from analytics page"
```

---

### Task 7: Extract TaskItem and TaskForm from tasks page

**Files:**
- Create: `src/lib/components/tasks/TaskItem.svelte`
- Create: `src/lib/components/tasks/TaskForm.svelte`
- Modify: `src/routes/(app)/tasks/+page.svelte`

The tasks page (481 lines) mixes data loading, a full add-task form, inline edit state, and individual task row rendering. Split into focused units.

- [ ] **Step 1: Read the full tasks page**

Read `src/routes/(app)/tasks/+page.svelte` to identify the boundaries:
- The add-task form: the `<form>` block with `titleInput`, `priorityInput`, `dueDateInput`, `subjectIdInput`
- The task row: the `<li>` / task item block with complete, edit, delete, undo logic
- The edit state variables: `editingTaskId`, `editTaskTitle`, etc.

- [ ] **Step 2: Create `src/lib/components/tasks/TaskForm.svelte`**

Props and events:
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Subject, Priority } from '$lib/types';

  export let subjects: Subject[] = [];

  const dispatch = createEventDispatcher<{ add: { title: string; priority: Priority; dueDate: string; subjectId: string } }>();

  let title = '';
  let priority: Priority = 'medium';
  let dueDate = '';
  let subjectId = '';
  let titleError = false;

  function handleSubmit() {
    if (!title.trim()) { titleError = true; return; }
    dispatch('add', { title: title.trim(), priority, dueDate, subjectId });
    title = ''; priority = 'medium'; dueDate = ''; subjectId = ''; titleError = false;
  }
</script>

<!-- [form template with all add-task fields] -->
```

Move the add-task form HTML and its CSS rules into this component.

- [ ] **Step 3: Create `src/lib/components/tasks/TaskItem.svelte`**

Props and events:
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Task, Subject } from '$lib/types';

  export let task: Task;
  export let subjects: Subject[];

  const dispatch = createEventDispatcher<{
    complete: { id: string };
    delete: { id: string };
    save: { task: Task };
  }>();

  let editing = false;
  let editTitle = '';
  let editDueDate = '';
  let editPriority: Task['priority'] = 'medium';
  let editSubjectId: string | undefined = undefined;

  function startEdit() {
    editing = true;
    editTitle = task.title;
    editDueDate = task.dueDate ?? '';
    editPriority = task.priority;
    editSubjectId = task.subjectId;
  }

  function saveEdit() {
    dispatch('save', { task: { ...task, title: editTitle.trim(), dueDate: editDueDate || undefined, priority: editPriority, subjectId: editSubjectId } });
    editing = false;
  }
</script>

<!-- [task row template] -->
```

Move the task `<li>` HTML and item-specific CSS into this component.

- [ ] **Step 4: Update `tasks/+page.svelte` to use the extracted components**

Add imports:
```ts
import TaskForm from '$lib/components/tasks/TaskForm.svelte';
import TaskItem from '$lib/components/tasks/TaskItem.svelte';
```

Replace the inline form and task `<li>` with:
```svelte
<TaskForm subjects={$subjects} on:add={handleAdd} />

{#each filtered as task (task.id)}
  <TaskItem {task} subjects={$subjects}
    on:complete={e => handleComplete(e.detail.id)}
    on:delete={e => handleDelete(e.detail.id)}
    on:save={e => handleSave(e.detail.task)}
  />
{/each}
```

The page keeps: filter state, `filtered` derived, `handleAdd` / `handleComplete` / `handleDelete` / `handleSave` functions, undo toast state, and `onMount`.

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add src/lib/components/tasks/ src/routes
git commit -m "refactor: extract TaskItem and TaskForm components from tasks page"
```

---

## Phase 4 — Data Layer

### Task 8: Replace auth-context singleton with derived store

**Files:**
- Modify: `src/lib/stores/data.ts`
- Modify: `src/routes/(app)/schedule/+page.svelte`

**Problem:** `_userId` and `_mode` are module-level mutable variables set inside `loadData()`. Any code that calls `getAuthContext()` or `loadScheduleSlots()` before `loadData()` completes gets stale `'guest'` state — already caused one production bug.

**Fix:** Derive auth context reactively from the `auth` store, so it is always current regardless of call order.

- [ ] **Step 1: Add `authCtx` derived store and `get` import to `data.ts`**

At the top of `src/lib/stores/data.ts`, add:
```ts
import { writable, derived, get } from 'svelte/store';
import { auth } from '$lib/stores/auth';
```

After the `tasksDueToday` derived store, add:
```ts
export const authCtx = derived(auth, ($auth) => ({
  userId: $auth.mode === 'authenticated' ? ($auth.user?.id ?? '') : 'guest',
  mode: ($auth.mode === 'loading' ? 'guest' : $auth.mode) as 'guest' | 'authenticated',
}));
```

- [ ] **Step 2: Update `getAuthContext()` to read from the derived store**

Replace:
```ts
export function getAuthContext(): { userId: string; mode: 'guest' | 'authenticated' } {
  return { userId: _userId, mode: _mode };
}
```
With:
```ts
export function getAuthContext(): { userId: string; mode: 'guest' | 'authenticated' } {
  return get(authCtx);
}
```

- [ ] **Step 3: Update `loadScheduleSlots()` to use `get(authCtx)` instead of `_userId`/`_mode`**

Replace the body of `loadScheduleSlots`:
```ts
export async function loadScheduleSlots(weekStart: Date, weekEnd: Date): Promise<void> {
  const { userId, mode } = get(authCtx);
  const slots = await db.getScheduleSlots(
    userId, mode,
    weekStart.toISOString().substring(0, 19),
    weekEnd.toISOString().substring(0, 19)
  );
  scheduleSlots.set(slots);
}
```

- [ ] **Step 4: Update `loadData()` to use `get(authCtx)` internally**

Replace:
```ts
export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  _mode = authState.mode;
  _userId = authState.mode === 'guest' ? 'guest' : (authState.user?.id ?? '');
  ...
```
With:
```ts
export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  const { userId, mode } = get(authCtx);
  ...
```

Then replace all `_userId` / `_mode` references in the function body with `userId` / `mode`.

- [ ] **Step 5: Remove now-unused `_userId` and `_mode` variables**

Delete lines:
```ts
let _mode: 'guest' | 'authenticated' = 'guest';
let _userId = 'guest';
```

- [ ] **Step 6: Remove ordering workaround in `schedule/+page.svelte`**

Read `src/routes/(app)/schedule/+page.svelte`. Find any comment about ordering between `loadData` and `loadScheduleSlots`. The derived store means ordering no longer matters — remove the workaround comment and any artificial sequencing.

- [ ] **Step 7: Verify**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 8: Commit**

```
git add src/lib/stores/data.ts src/routes
git commit -m "fix: replace _userId/_mode singleton with derived authCtx store — eliminates stale auth state bug"
```

---

## Phase 5 — Playwright Smoke Tests

### Task 9: Install and configure Playwright

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Playwright**

```
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Add test scripts to `package.json`**

```json
"test": "playwright test",
"test:ui": "playwright test --ui"
```

- [ ] **Step 4: Commit**

```
git add playwright.config.ts package.json package-lock.json
git commit -m "feat: add Playwright test runner config"
```

---

### Task 10: Write smoke tests — guest dashboard and subjects

**Files:**
- Create: `tests/guest-dashboard.spec.ts`
- Create: `tests/subjects.spec.ts`

- [ ] **Step 1: Create `tests/guest-dashboard.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('guest mode: dashboard loads without blank page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).not.toBeEmpty();
  // Sidebar should be visible
  await expect(page.getByText('Dashboard')).toBeVisible();
});

test('guest mode: hard refresh does not blank the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await page.reload();
  await expect(page.getByText('Dashboard')).toBeVisible();
});
```

- [ ] **Step 2: Create `tests/subjects.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('guest mode: add a subject and it appears in the list', async ({ page }) => {
  await page.goto('/subjects');
  // Click add subject button (find by role or text)
  await page.getByRole('button', { name: /add subject/i }).click();
  // Fill in a subject name
  await page.getByPlaceholder(/subject name/i).fill('Test Subject');
  await page.getByRole('button', { name: /save/i }).click();
  // It should appear in the list
  await expect(page.getByText('Test Subject')).toBeVisible();
});
```

- [ ] **Step 3: Run tests**

Start the dev server first (`npm run dev`) then in a separate terminal:
```
npm run test
```
Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```
git add tests/
git commit -m "test: add Playwright smoke tests for guest dashboard and subjects"
```

---

### Task 11: Write smoke tests — schedule and timer

**Files:**
- Create: `tests/schedule.spec.ts`
- Create: `tests/timer.spec.ts`

- [ ] **Step 1: Create `tests/schedule.spec.ts`**

This test specifically catches the `_userId` ordering bug that Phase 4 fixed.

```ts
import { test, expect } from '@playwright/test';

test('guest mode: schedule page loads on direct navigation', async ({ page }) => {
  await page.goto('/schedule');
  // Week grid should render — look for day headers (Mon, Tue, etc.)
  await expect(page.locator('.week-grid, [class*="week"]').first()).toBeVisible();
});

test('guest mode: hard refresh on schedule page does not error', async ({ page }) => {
  await page.goto('/schedule');
  await page.reload();
  // No error overlay should appear
  await expect(page.locator('body')).not.toContainText('Error');
  await expect(page.locator('body')).not.toContainText('Cannot read');
});
```

- [ ] **Step 2: Create `tests/timer.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('guest mode: timer page loads and start button is present', async ({ page }) => {
  await page.goto('/timer');
  // Start button or subject selector should be visible
  const startBtn = page.getByRole('button', { name: /start/i });
  await expect(startBtn.or(page.getByText(/select subject/i))).toBeVisible();
});
```

- [ ] **Step 3: Run all tests**

```
npm run test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add tests/
git commit -m "test: add Playwright smoke tests for schedule page (auth ordering) and timer"
```

---

## Definition of Done Checklist

- [ ] `npm run check:all` passes — zero type errors, zero lint errors
- [ ] No hardcoded hex colors remain in any `.svelte` file (outside theme token definitions in `app.css`)
- [ ] `authCtx` derived store is in place — `_userId`/`_mode` singleton removed
- [ ] `tasks/+page.svelte` < 200 lines
- [ ] `analytics/+page.svelte` < 250 lines
- [ ] `npm run test` passes all smoke tests in guest mode
- [ ] CLAUDE.md Active Plans updated (move this plan from Open → Completed)

**Note on WeekGrid.svelte:** It remains at 735 lines. Decomposing it is the correct next step AFTER the Playwright tests are green — the tests will catch any regression during the split.
