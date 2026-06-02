# Schedule Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, contain the schedule's scroll to the time-grid and surface the hidden side-panel content (incl. AI accept/reject-all) via a bottom sheet.

**Architecture:** Two independent fixes. (1) Scroll containment: the `/schedule` route opts `.main-content` out of its padding + page-scroll (full-bleed, mobile only), so the schedule owns the height and WeekGrid's existing internal scroll is the only scroll — no WeekGrid change. (2) A new reusable `BottomSheet.svelte`, opened by a slim trigger tab (CSS-hidden on desktop), holding the existing `ScheduleSidebar` + `MiniMonth`. An AI pill on the trigger surfaces pending suggestions.

**Tech Stack:** SvelteKit 2, TypeScript, Svelte transitions, Pointer Events, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-schedule-mobile-layout-design.md`.

**Plan deviations from spec (intentional, verified against code):**
- Spec said gate the mobile UI with a `matchMedia` `isMobile`. Instead the trigger tab and sheet are **CSS-hidden ≥768px** — the trigger is the only way to open the sheet, so desktop can't reach it. This avoids the SSR→client hydration flash a JS gate would cause. No `isMobile` variable.
- Spec listed an `ExamBanner` compact task. Reading `ExamBanner.svelte`, it's **already** a slim one-line `flex-shrink:0` strip (~28px). Requirement already met → no task.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/pendingAiCount.ts` (+ `.test.ts`) | **new** — pure helper: count AI-suggested slots (the pill source) |
| `src/lib/components/BottomSheet.svelte` | **new** — reusable bottom sheet (backdrop, handle, swipe/tap/Esc close, safe-area) |
| `src/routes/(app)/+layout.svelte` | full-bleed `.main-content` on the `/schedule` route (mobile only) |
| `src/routes/(app)/schedule/+page.svelte` | summary trigger tab + `BottomSheet` wrapping `MiniMonth` + `ScheduleSidebar` |

---

## Task 1: `pendingAiCount` helper

**Files:**
- Create: `src/lib/pendingAiCount.ts`
- Test: `src/lib/pendingAiCount.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pendingAiCount.test.ts
import { describe, it, expect } from 'vitest';
import { pendingAiCount } from './pendingAiCount';
import type { ScheduleSlot } from './types';

function slot(p: Partial<ScheduleSlot>): ScheduleSlot {
  return {
    id: 'x', userId: 'guest', startTime: '2026-06-04T09:00:00', endTime: '2026-06-04T10:00:00',
    subjectId: null, topicId: null, isAiSuggested: false, isFocusBlock: false, ...p,
  } as ScheduleSlot;
}

describe('pendingAiCount', () => {
  it('counts only AI-suggested slots', () => {
    const slots = [slot({ isAiSuggested: true }), slot({ isAiSuggested: false }), slot({ isAiSuggested: true })];
    expect(pendingAiCount(slots)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(pendingAiCount([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pendingAiCount.test.ts`
Expected: FAIL — cannot resolve `./pendingAiCount`. (If it errors on a missing `.svelte-kit/tsconfig.json`, run `npx svelte-kit sync` first.)

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/pendingAiCount.ts
import type { ScheduleSlot } from './types';

/** Number of AI-suggested slots awaiting accept/reject. Source for the mobile "N AI" pill. */
export function pendingAiCount(slots: ScheduleSlot[]): number {
  return slots.filter((s) => s.isAiSuggested).length;
}
```

> Note: confirm `ScheduleSlot` has a boolean `isAiSuggested` field (it's used in `CalBlock.svelte` and `schedule/+page.svelte` `handleAcceptAll`). If the field name differs, match the real one.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pendingAiCount.test.ts`
Expected: PASS — 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pendingAiCount.ts src/lib/pendingAiCount.test.ts
git commit -m "feat: add pendingAiCount helper for the schedule AI pill"
```

---

## Task 2: `BottomSheet.svelte`

**Files:**
- Create: `src/lib/components/BottomSheet.svelte`

A reusable sheet: dimmed backdrop, panel sliding up from the bottom, a grab handle (tap to close), swipe-down-to-close, Escape to close, safe-area inset, reduced-motion aware. `open` prop + `close` event.

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/components/BottomSheet.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();
  function close() { dispatch('close'); }

  let prefersReduced = false;
  onMount(() => { prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; });
  $: dur = prefersReduced ? 0 : 240;

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) { e.stopPropagation(); close(); }
  }

  // swipe-down on the handle area closes the sheet
  let dragging = false;
  let startY = 0;
  let dragY = 0;
  function onPointerdown(e: PointerEvent) {
    dragging = true; startY = e.clientY; dragY = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointermove(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function onPointerup() {
    if (!dragging) return;
    dragging = false;
    if (dragY > 70) close();
    dragY = 0;
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="sheet-backdrop" on:click={close} transition:fade={{ duration: dur }} aria-hidden="true"></div>
  <div
    class="sheet-panel"
    role="dialog"
    aria-modal="true"
    style="transform: translateY({dragY}px);"
    transition:fly={{ y: 400, duration: dur }}
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="sheet-grip"
      on:pointerdown={onPointerdown}
      on:pointermove={onPointermove}
      on:pointerup={onPointerup}
    >
      <button class="sheet-handle" on:click={close} aria-label="Close"></button>
    </div>
    <div class="sheet-content">
      <slot />
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.45);
  }
  .sheet-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 301;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--bg2);
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.25);
    padding-bottom: env(safe-area-inset-bottom);
    color: var(--text);
  }
  .sheet-grip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px 0 6px;
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    padding: 0;
    border: none;
    border-radius: 2px;
    background: var(--border);
    cursor: pointer;
  }
  .sheet-content {
    overflow-y: auto;
    padding: 0 14px 14px;
    min-height: 0;
  }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check` (run `npx svelte-kit sync` first if it reports a missing tsconfig)
Expected: 0 errors for `BottomSheet.svelte`. (Pre-existing `supabase.ts` env errors only appear if `.env.local` is absent — unrelated. Ignore any pre-existing a11y warnings in other files.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/BottomSheet.svelte
git commit -m "feat: add reusable BottomSheet component (backdrop, swipe/tap/Esc close, safe-area)"
```

---

## Task 3: Full-bleed schedule route in the app layout

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

Make only the `/schedule` route drop `.main-content`'s padding and page-scroll on mobile, so the schedule fills the shell (minus the fixed tab bar) and scrolls only internally. The TabBar is fixed-positioned, so we must **keep a bottom inset** equal to the tab bar height or the grid hides behind it.

- [ ] **Step 1: Add the route check to the script**

In `src/routes/(app)/+layout.svelte`, add the `page` store import. The script becomes:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import TabBar from '$lib/components/TabBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MoreDrawer from '$lib/components/MoreDrawer.svelte';
  import Toaster from '$lib/components/Toaster.svelte';

  let drawerOpen = false;
</script>
```

- [ ] **Step 2: Add the conditional class to `.main-content`**

Change the `<main>` element to toggle `full-bleed` on the schedule route (route groups don't appear in the URL, so `/schedule` is the pathname):

```svelte
  <main class="main-content page-enter" class:full-bleed={$page.url.pathname === '/schedule'}><slot /></main>
```

- [ ] **Step 3: Add the full-bleed CSS (mobile only)**

Add this rule inside the existing `<style>` block (after the `.main-content` rule). It zeroes top/side padding and removes page-scroll, but preserves the bottom inset for the fixed tab bar. Desktop is untouched (the rule is inside the `max-width: 768px` query):

```css
  @media (max-width: 768px) {
    .main-content.full-bleed {
      padding: 0 0 calc(var(--tab-bar-height) + env(safe-area-inset-bottom)) 0;
      overflow: hidden;
    }
  }
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/(app)/+layout.svelte
git commit -m "feat: full-bleed .main-content on the /schedule route (mobile scroll containment)"
```

---

## Task 4: Summary trigger + bottom sheet on the schedule page

**Files:**
- Modify: `src/routes/(app)/schedule/+page.svelte`

Add a slim trigger tab at the bottom of the grid (CSS-hidden on desktop) showing the AI pill, and a `BottomSheet` that reuses the existing `MiniMonth` + `ScheduleSidebar` with their current props/handlers. The existing `display:none` mobile rules for `.left-panel` / `.schedule-sidebar` stay (their desktop placements remain hidden on phone; the content reappears in the sheet).

- [ ] **Step 1: Add imports + state to the script**

In `src/routes/(app)/schedule/+page.svelte`, add to the imports (alongside the existing component imports near the top):

```ts
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { pendingAiCount } from '$lib/pendingAiCount';
```

Add this state + derived near the other `let`/`$:` declarations (e.g. just after `let isScheduling = false;`):

```ts
  let sheetOpen = false;
  $: aiPending = pendingAiCount($scheduleSlots);
```

- [ ] **Step 2: Add the trigger tab inside `.main-area`, after `<WeekGrid …/>`**

Immediately after the closing `/>` of the `<WeekGrid … />` element (still inside `.main-area`), add:

```svelte
    <button class="summary-tab" on:click={() => (sheetOpen = true)}>
      <span>▴ Week summary</span>
      {#if aiPending > 0}<span class="ai-pill">{aiPending} AI</span>{/if}
    </button>
```

- [ ] **Step 3: Add the BottomSheet after the closing `</div>` of `.schedule-wrap`**

After the `</div>` that closes `.schedule-wrap` (the outer wrapper), add the sheet. It reuses the same components/props as the desktop panels, and a week pick closes the sheet:

```svelte
<BottomSheet open={sheetOpen} on:close={() => (sheetOpen = false)}>
  <ScheduleSidebar
    slots={$scheduleSlots}
    subjects={$subjects}
    topics={$topics}
    srsCards={$srsCards}
    settings={$settings}
    weekStart={viewedWeekStart}
    on:acceptAll={handleAcceptAll}
    on:rejectAll={handleRejectAll}
  />
  <MiniMonth
    currentWeekStart={viewedWeekStart}
    sessions={$sessions}
    tasks={$tasks}
    subjects={$subjects}
    on:weekSelect={(e) => { viewedWeekStart = e.detail; sheetOpen = false; }}
  />
</BottomSheet>
```

> The `.schedule-sidebar` inside `ScheduleSidebar` is the panel that's `display:none` on mobile in its desktop slot — but here it's inside the sheet (not in that slot), so it renders. If `ScheduleSidebar`'s root has the `:global(.schedule-sidebar){ display:none !important }` rule biting inside the sheet too, override it in the sheet styles (Step 4) with `:global(.schedule-sidebar){ display: block !important }` scoped under the sheet wrapper. Verify in the browser (Task 5) and add the override only if needed.

- [ ] **Step 4: Add the trigger CSS (mobile-only) in the page `<style>`**

Add to the schedule page `<style>` block:

```css
  .summary-tab {
    display: none;
  }
  @media (max-width: 768px) {
    .summary-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-top: 1px solid var(--border);
      background: var(--bg2);
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .ai-pill {
      background: var(--warning, #e5a23c);
      color: var(--bg);
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 8px;
    }
  }
```

> If `--warning` isn't a defined token in all themes, fall back to `var(--primary)`; check `app.css` token list. The trigger sits as the last `flex-shrink:0` child of `.main-area`, so it pins to the bottom of the schedule above the tab bar.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/(app)/schedule/+page.svelte
git commit -m "feat: mobile bottom sheet for schedule panels + AI pill trigger"
```

---

## Task 5: Verify on mobile emulation + desktop

**Files:** none (verification only).

Setup note: this is a worktree. For the dev server to hydrate, copy the env file and widen Vite fs.allow temporarily: `cp ../../../.env.local .env.local` (from repo root: copy `/.env.local` into the worktree), and add `server: { fs: { allow: ['C:/Users/HP/Documents/pulse'] } }` to `vite.config.ts` for the session, then revert it before finishing (do not commit it).

- [ ] **Step 1: Type-check + unit tests**

Run: `npm run check` → 0 errors. Run: `npx vitest run` → all pass (incl. `pendingAiCount`).

- [ ] **Step 2: Mobile emulation (iPhone, touch)**

Start `npm run dev`, open `/schedule`, emulate an iPhone viewport with touch. Verify:
- The page fills the viewport and **does not page-scroll**; the week-nav header + day-of-week row stay pinned while the **time-grid scrolls** inside itself.
- The grid bottom + the **"▴ Week summary" tab** sit above the bottom tab bar (not hidden behind it).
- Seed an AI-suggested slot (or run Auto-schedule) → the **"N AI" pill** shows on the tab.
- Tapping the tab opens the sheet; it shows ScheduleSidebar (THIS WEEK / BY SUBJECT / SRS / AI accept-reject) + MiniMonth.
- **Accept-all / reject-all** work from the sheet (slots update).
- Picking a week in the sheet's MiniMonth navigates the week **and** closes the sheet.
- Backdrop tap, the handle, swipe-down, and Escape all close the sheet.

- [ ] **Step 3: Desktop regression**

Resize to ≥768px (or disable emulation): the 3-column layout is unchanged, the trigger tab and sheet are not visible, and the schedule still scrolls/behaves as before.

- [ ] **Step 4: Revert the temporary Vite change**

`git checkout vite.config.ts` (remove the `fs.allow` widening). Confirm `git status` shows only the intended source changes.

---

## Self-review (completed during planning)

**Spec coverage:** §5.1 scroll containment → Task 3 (full-bleed; WeekGrid unchanged, as corrected in the spec). §5.2 bottom sheet (closed tab + AI pill, open with 4 sections, close affordances) → Tasks 2 + 4. §5.3 new BottomSheet, mobile branch, component reuse → Tasks 2 + 4 (CSS-gate instead of `matchMedia`, deviation noted). §5.4 AI count from `scheduleSlots` → Task 1 + 4. §6 testing → Tasks 1 + 5. ExamBanner: already satisfied (noted). All covered.

**Placeholder scan:** none — every code step is complete. The two `>` notes (ScheduleSidebar display override, `--warning` fallback) are conditional verifications with the concrete fix given, not deferred work.

**Type consistency:** `pendingAiCount(slots: ScheduleSlot[]): number` defined in Task 1, consumed in Task 4 (`aiPending = pendingAiCount($scheduleSlots)`). `BottomSheet` exposes `open` prop + `close` event (Task 2), consumed exactly so in Task 4. `ScheduleSidebar` / `MiniMonth` props + events (`acceptAll`, `rejectAll`, `weekSelect`) match the existing desktop usage in the same file.
