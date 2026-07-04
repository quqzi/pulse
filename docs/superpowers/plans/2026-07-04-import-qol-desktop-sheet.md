# Import QoL + Desktop Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI import (flashcards + exam questions) trustworthy and fast, and make every bottom sheet render as a proper centered dialog on desktop.

**Architecture:** All work is client-side; no schema changes. Phase 1 fixes one shared component (`BottomSheet.svelte`) which repairs desktop UI for every sheet in the app. Phase 2 upgrades the shared `ImportSheet.svelte` + `import.ts` parser + adds a bulk `saveMany` to the repo engine.

**Tech Stack:** SvelteKit 2, Svelte 4 idiom, repo engine (`src/lib/data/`), vitest.

## Global Constraints

- Both auth modes must work: guest (localStorage) and authenticated (Supabase).
- No hardcoded colors — CSS tokens only; token additions must exist in all five theme blocks.
- i18n: every new string goes in both `src/lib/i18n/en.ts` and `th.ts`.
- `npm run check` zero errors; `npx vitest run` green before each commit.
- Modals/sheets stay portaled to `<body>`.

---

## Phase 1 — BottomSheet becomes a centered dialog on desktop

### Task 1: Desktop dialog mode in `BottomSheet.svelte`

**Files:**
- Modify: `src/lib/components/BottomSheet.svelte`

**Interfaces:**
- Produces: no API change — same `open` prop + `close` event. Pure CSS/markup change so all consumers (ImportSheet, SubjectEditSheet, MoreDrawer callers, etc.) get the fix for free.

- [ ] **Step 1: Add the desktop media query**

In the `<style>` block, keep current mobile styles and add:

```css
@media (min-width: 768px) {
  .sheet-panel {
    left: 50%;
    right: auto;
    bottom: auto;
    top: 50%;
    transform: translate(-50%, -50%) !important; /* wins over the inline drag transform */
    width: min(560px, calc(100vw - 48px));
    max-height: min(80vh, 720px);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  }
  .sheet-grip { display: none; }
  .sheet-content { padding: 4px 20px 20px; }
}
```

Note: the inline `style="transform: translateY({dragY}px)"` is why `!important` is needed; alternatively gate the inline style with an `isDesktop` matchMedia flag — pick the matchMedia flag if `npm run check`-clean and simpler to reason about:

```ts
let isDesktop = false;
onMount(() => { isDesktop = window.matchMedia('(min-width: 768px)').matches; });
```
and render `style={isDesktop ? '' : `transform: translateY(${dragY}px);`}` — then no `!important`.

- [ ] **Step 2: Adjust fly transition for desktop**

Desktop should fade/scale, not fly 420px from the bottom. Use the `isDesktop` flag:

```ts
$: flyY = isDesktop ? 12 : 420;
```
and use `flyY` in the `in:fly` params (out: keep `y: isDesktop ? 8 : 400`).

- [ ] **Step 3: Verify in browser**

Run dev server; open the flashcards deck import sheet and exam bank import sheet at 1440px and 390px. Desktop: centered dialog, no grip, Esc + backdrop-click close. Mobile: unchanged bottom sheet with swipe-close.

- [ ] **Step 4: `npm run check` → 0 errors, then commit**

```bash
git add src/lib/components/BottomSheet.svelte
git commit -m "fix(ui): render BottomSheet as centered dialog on desktop"
```

---

## Phase 2 — Import QoL

### Task 2: Parser accepts letter answers + clearer errors

**Files:**
- Modify: `src/lib/import.ts`
- Test: `src/lib/import.test.ts`

**Interfaces:**
- Produces: `parseExamQuestions` additionally accepts `correct`/`answer` given as `"A" | "B" | "C" | "D"` (case-insensitive, also `"a."`/`"(b)"` tolerated via first-letter match).

- [ ] **Step 1: Write failing tests**

```ts
it('accepts letter answers', () => {
  const r = parseExamQuestions('[{"text":"q","choices":["1","2","3","4"],"correct":"B"}]');
  expect(r.ok && r.items[0].correctIndex).toBe(1);
});
it('accepts lowercase and decorated letters', () => {
  const r = parseExamQuestions('[{"text":"q","choices":["1","2","3","4"],"answer":"(c)"}]');
  expect(r.ok && r.items[0].correctIndex).toBe(2);
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/import.test.ts` — expect FAIL**

- [ ] **Step 3: Implement**

In `parseExamQuestions`, before the `Number(...)` coercion:

```ts
function letterIndex(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().toUpperCase().match(/[ABCD]/);
  return m ? m[0].charCodeAt(0) - 65 : null;
}
```
Use: `const ci = letterIndex(o.correctIndex ?? o.answerIndex ?? o.correct ?? o.answer) ?? Number(o.correctIndex ?? o.answerIndex ?? o.correct);`
(Only fall back to `Number` when `letterIndex` returns null.)

- [ ] **Step 4: Run tests — PASS; commit**

```bash
git add src/lib/import.ts src/lib/import.test.ts
git commit -m "feat(import): accept letter answers (A-D) in exam question JSON"
```

### Task 3: Bulk `saveMany` on the repo engine

**Files:**
- Modify: `src/lib/data/engine.ts` (add `saveMany` to `createRepository`)
- Modify: `src/lib/data/repository.ts` (expose it)
- Test: `src/lib/data/engine.test.ts`

**Interfaces:**
- Produces: `repo.saveMany(items: T[]): Promise<void>` — one adapter write, one store update, snapshot/rollback on error like `save`. Guest: single `lsWrite` of the merged list. Supabase: single `.insert(rows)` (import-only path — new rows, no upsert needed).

- [ ] **Step 1: Write failing engine test** (follow the existing `save` tests' arrange/act/assert shape in `engine.test.ts`: seed store, call `saveMany` with 3 items, assert store contains all + adapter called once).

- [ ] **Step 2: Run test — FAIL.**

- [ ] **Step 3: Implement `saveMany`** following the existing `writeThrough` pattern (snapshot store, optimistic set with all items inserted + resorted by the repo's `order`, adapter bulk write, rollback + toast on error).

- [ ] **Step 4: Test PASS → `npm run check` → commit**

```bash
git commit -m "feat(data): saveMany bulk write on repo engine"
```

### Task 4: Preview + dedupe + bulk import in `ImportSheet`

**Files:**
- Modify: `src/lib/components/ImportSheet.svelte`
- Modify: `src/routes/(app)/exam/questions/+page.svelte`
- Modify: `src/routes/(app)/flashcards/[topicId]/+page.svelte`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/th.ts`

**Interfaces:**
- `ImportSheet` gains two optional props:
  - `preview: (item: unknown) => { title: string; sub?: string }` — how to render one parsed item.
  - `isDuplicate: (item: unknown) => boolean` — page-supplied check against existing store data.
- Emits `import` with only the **checked** items (unchanged event shape `{ items: unknown[] }`).

- [ ] **Step 1: Preview list UI.** After a successful parse, render each item as a row: checkbox (default checked; default **unchecked** when `isDuplicate(item)` is true) + `preview(item).title` (1-line ellipsis) + optional `sub` + a `duplicate` badge when flagged. Cap list height (`max-height: 240px; overflow-y: auto`). Import button label counts only checked items.

- [ ] **Step 2: Wire pages.**
  - Flashcards: `preview: (i) => ({ title: i.front, sub: i.back })`; `isDuplicate`: case-insensitive `front` match against `deckCards`.
  - Exam: `preview: (i) => ({ title: i.text, sub: choices[correctIndex] })`; `isDuplicate`: case-insensitive `text` match against `$examQuestions` for the chosen subject.
  - Both `handleImport`s switch the per-item loop to a single `repo.saveMany(rows)`.

- [ ] **Step 3: i18n.** New keys in `importer`: `duplicate` ("Duplicate" / "ซ้ำ"), `selectedCount(n, total)` — add to both `en.ts` and `th.ts`.

- [ ] **Step 4: Browser-verify** both import flows (mobile + desktop widths): paste JSON with a duplicate → it's flagged + unchecked; import → only checked items land, single toast, list updates instantly.

- [ ] **Step 5: `npm run check` + `npx vitest run` → commit**

```bash
git commit -m "feat(import): preview parsed items, flag duplicates, bulk save"
```

---

## Verification (whole plan)

- `npm run check` 0 errors; `npx vitest run` green (new parser + engine tests included).
- Desktop 1440px: every sheet (import, subject edit) is a centered dialog; mobile 390px unchanged.
- Import 30 flashcards while authenticated → single insert (fast), one store update.
- Re-paste the same JSON → all rows flagged duplicate + unchecked.
- Guest mode: same flows against localStorage.
- EN + TH strings render.
