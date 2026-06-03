# Mobile A11y — Touch Targets + Tab-bar Contrast + /review Message — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make flagged interactive controls ≥44px on phones, fix the bottom tab-bar inactive contrast, and replace the silent `/review` redirect with a friendly toast.

**Architecture:** Additive scoped CSS — each control gets a `@media (max-width: 768px)` rule with `min-height: 44px` (+ flex-centering for buttons) so desktop stays unchanged. The tab-bar drops its `opacity: 0.55`. `/review` pushes a toast via the existing `toast` store before redirecting.

**Tech Stack:** SvelteKit 2, scoped CSS, existing `$lib/stores/toast`.

**Spec:** `docs/superpowers/specs/2026-06-03-mobile-a11y-touch-targets-design.md`.

**Testing note:** All changes are CSS / a one-line toast — no unit tests. Verified in browser/emulation (Task 4): each control measures ≥44px on a phone, tab-bar contrast, `/review` toast.

---

## File structure

| File | Change |
|---|---|
| `timer/+page.svelte`, `QuickLog.svelte`, `tasks/+page.svelte`, `subjects/+page.svelte`, `scores/+page.svelte`, `settings/+page.svelte` | add a `@media (max-width:768px)` block bumping the flagged controls to ≥44px |
| `TabBar.svelte` | drop inactive `opacity: 0.55` |
| `review/+page.svelte` | toast before redirect when no cards due |

---

## Task 1: Touch-target bumps (≥44px, mobile-scoped)

For each file, append the shown `@media (max-width: 768px) { … }` block at the **end** of its `<style>` block (just before `</style>`). These are additive overrides — they don't touch the existing rules. Buttons get flex-centering so text stays vertically centered with the larger min-height; inputs/selects just get `min-height` (browsers center their own text).

**Files:**
- Modify: `src/routes/(app)/timer/+page.svelte`
- Modify: `src/lib/components/QuickLog.svelte`
- Modify: `src/routes/(app)/tasks/+page.svelte`
- Modify: `src/routes/(app)/subjects/+page.svelte`
- Modify: `src/routes/(app)/scores/+page.svelte`
- Modify: `src/routes/(app)/settings/+page.svelte`

- [ ] **Step 1: `timer/+page.svelte`** — append before `</style>`:

```css
  @media (max-width: 768px) {
    .mode-tab { min-height: 44px; display: flex; align-items: center; justify-content: center; }
    .focus-toggle { min-height: 44px; display: inline-flex; align-items: center; padding: 10px 8px; }
  }
```

- [ ] **Step 2: `QuickLog.svelte`** — append before `</style>`:

```css
  @media (max-width: 768px) {
    .field-select { min-height: 44px; }
    .duration-input { min-height: 44px; }
    .log-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  }
```

- [ ] **Step 3: `tasks/+page.svelte`** — append before `</style>`:

```css
  @media (max-width: 768px) {
    .filter-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  }
```

- [ ] **Step 4: `subjects/+page.svelte`** — append before `</style>`:

```css
  @media (max-width: 768px) {
    .add-btn { width: 44px; height: 44px; }
    .templates-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; }
  }
```

- [ ] **Step 5: `scores/+page.svelte`** — append before `</style>`:

```css
  @media (max-width: 768px) {
    .btn-add-score { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  }
```

- [ ] **Step 6: `settings/+page.svelte`** — append before `</style>`:

```css
  @media (max-width: 768px) {
    .num-input { min-height: 44px; }
    input[type='range'] { min-height: 44px; }
  }
```

> Note: `input[type='range']` is scoped by Svelte to range inputs in `settings/+page.svelte`. If the settings page has a range whose container clips a 44px height, the min-height still enlarges the element's own hit area; verify in Task 4.

- [ ] **Step 7: Type-check + commit**

Run: `npm run check` (run `npx svelte-kit sync` first if it reports a missing tsconfig) → 0 new errors. (Pre-existing `supabase.ts` env errors appear only without `.env.local`.)

```bash
git add "src/routes/(app)/timer/+page.svelte" src/lib/components/QuickLog.svelte "src/routes/(app)/tasks/+page.svelte" "src/routes/(app)/subjects/+page.svelte" "src/routes/(app)/scores/+page.svelte" "src/routes/(app)/settings/+page.svelte"
git commit -m "feat: 44px touch targets on mobile for timer/quicklog/tasks/subjects/scores/settings"
```

---

## Task 2: Tab-bar inactive contrast

**Files:**
- Modify: `src/lib/components/TabBar.svelte`

The `.tab-item` rule has `... color: var(--muted); opacity: 0.55; ...`. Inactive items therefore render at 55% opacity, failing contrast. Remove the `opacity: 0.55` so they render at full-strength `var(--muted)` (active items already set their own color + `opacity: 1`).

- [ ] **Step 1: Drop the inactive opacity**

In `.tab-item`, change the line `border: none; background: transparent; color: var(--muted); opacity: 0.55;` to remove `opacity: 0.55;`:

```css
    border: none; background: transparent; color: var(--muted);
```

Leave the `transition` (which references `opacity`) as-is — it's harmless, and the `.tab-item.active { … opacity: 1 }` rule is now simply a no-op default.

- [ ] **Step 2: Type-check + commit**

Run: `npm run check` → 0 new errors.

```bash
git add src/lib/components/TabBar.svelte
git commit -m "fix: tab-bar inactive items full-strength muted color (drop opacity 0.55 a11y)"
```

(Task 4 verifies `var(--muted)` on the tab-bar background is legible across themes; if a theme is still weak, a follow-up token nudge — out of scope unless the check fails.)

---

## Task 3: `/review` nothing-due toast

**Files:**
- Modify: `src/routes/(app)/review/+page.svelte`

When `onMount` finds no due cards it currently does `goto('/dashboard')` silently. Push a toast first.

- [ ] **Step 1: Import the toast store**

In the `<script>` of `src/routes/(app)/review/+page.svelte`, add (next to the other `$lib` imports):

```ts
  import { toast } from '$lib/stores/toast';
```

- [ ] **Step 2: Toast before redirect**

Change the empty-queue branch (currently):

```ts
    if (queue.length === 0) {
      goto('/dashboard');
      return;
    }
```

to:

```ts
    if (queue.length === 0) {
      toast.info("No cards due — you're all caught up 🎉");
      goto('/dashboard');
      return;
    }
```

- [ ] **Step 3: Type-check + commit**

Run: `npm run check` → 0 new errors.

```bash
git add "src/routes/(app)/review/+page.svelte"
git commit -m "feat: friendly 'nothing due' toast on /review instead of silent redirect"
```

---

## Task 4: Verify on mobile + desktop

**Files:** none (verification only).

Setup (worktree): `cp ../../../.env.local .env.local`; add `server: { fs: { allow: ['C:/Users/HP/Documents/pulse'] } }` to `vite.config.ts` for the session (revert before finishing — don't commit).

- [ ] **Step 1: Type-check + tests**

Run: `npm run check` → 0 errors. Run: `npx vitest run` → all pass (no new tests; confirms nothing broke).

- [ ] **Step 2: Measure controls on mobile**

`npm run dev`, emulate an iPhone (390×844, touch). On each page, measure the flagged controls' heights via `getBoundingClientRect().height` — all must be **≥44**:
- `/timer`: `.mode-tab`, `.focus-toggle`
- `/dashboard`: `.field-select`, `.duration-input`, `.log-btn` (in QuickLog)
- `/tasks`: `.filter-btn`
- `/subjects`: `.add-btn` (44×44), `.templates-link`
- `/scores`: `.btn-add-score`
- `/settings`: `.num-input`, `input[type='range']`

- [ ] **Step 3: Tab-bar contrast**

On mobile, confirm the bottom tab-bar inactive items render without the washed-out 55% opacity (computed `opacity` is `1`); eyeball the inactive label against the bar in a light theme (vercel-light) and a dark theme (vercel-dark).

- [ ] **Step 4: `/review` toast**

With no due SRS cards (guest mode default), navigate to `/review` → a toast "No cards due — you're all caught up 🎉" appears and it lands on `/dashboard`.

- [ ] **Step 5: Desktop regression**

At ≥768px, the controls are visually unchanged (the bumps don't apply); tab-bar is mobile-only anyway.

- [ ] **Step 6: Revert the temporary Vite change**

`git checkout vite.config.ts`; confirm `git status` shows only intended source changes.

---

## Self-review (completed during planning)

**Spec coverage:** §5.1 touch targets (all 11 controls across 6 files) → Task 1; §5.2 tab-bar contrast → Task 2; §5.3 /review toast → Task 3; §6 verification → Task 4. All covered. The control class names + owners were verified against the code (incl. `.btn-add-score` → `scores/+page.svelte`, timer's own `.focus-toggle`, `toast.info`).

**Placeholder scan:** none — every step has the exact CSS / code to add. The `input[type='range']` note is a verification caveat with the concrete rule given, not deferred work.

**Type consistency:** `toast.info(message)` matches the `$lib/stores/toast` export (`toast = { error, success, info }`). The `@media (max-width: 768px)` breakpoint matches the app's existing convention used by the schedule full-bleed work.
