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

### Task 2: Parser hardening — survive real messy AI output

> Verified 2026-07-04 by probing the live parser: 6 realistic failure modes currently break it.
> Happy paths (fences, leading prose, key aliases, `"2"` string numbers) already pass — don't regress them.

**Files:**
- Modify: `src/lib/import.ts`
- Test: `src/lib/import.test.ts`

**Interfaces:**
- `extractJson` additionally cuts **trailing** prose (balance-scan to the matching close bracket) and strips trailing commas before `}`/`]`.
- `parseExamQuestions` additionally accepts: letter answers (`"B"`, `"(c)"`, `"a."`), the literal choice text as the answer, `correct: 4` remapped to index 3 (only 4 → 3: unambiguously 1-based), and >4 choices (keep first 4 iff the resolved correct index is < 4, else drop).
- `ImportResult` success gains a `skipped: number` count so the UI can say "imported 8, skipped 2" instead of silently losing items.

- [ ] **Step 1: Write failing tests** — one `it` per verified failure mode:

```ts
it('tolerates trailing prose after the array', () => {
  expect(parseFlashcards('[{"front":"f","back":"b"}] \nHope this helps!').ok).toBe(true);
});
it('tolerates a trailing comma', () => {
  expect(parseFlashcards('[{"front":"f","back":"b",}]').ok).toBe(true);
});
it('accepts letter answers incl. decorated/lowercase', () => {
  const r = parseExamQuestions('[{"text":"q","choices":["1","2","3","4"],"answer":"(c)"}]');
  expect(r.ok && r.items[0].correctIndex).toBe(2);
});
it('remaps correct:4 (1-based) to index 3', () => {
  const r = parseExamQuestions('[{"text":"q","choices":["1","2","3","4"],"correct":4}]');
  expect(r.ok && r.items[0].correctIndex).toBe(3);
});
it('accepts the answer as the choice text', () => {
  const r = parseExamQuestions('[{"text":"q","choices":["a","b","c","d"],"answer":"c"}]');
  expect(r.ok && r.items[0].correctIndex).toBe(2);
});
it('keeps first 4 of 5 choices when the answer is among them', () => {
  const r = parseExamQuestions('[{"text":"q","choices":["a","b","c","d","e"],"correctIndex":0}]');
  expect(r.ok && r.items[0].choices.length).toBe(4);
});
it('reports skipped count', () => {
  const r = parseFlashcards('[{"front":"f","back":"b"},{"front":"only front"}]');
  expect(r.ok && r.skipped).toBe(1);
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/import.test.ts` — expect the new tests to FAIL, all 28 existing to PASS**

- [ ] **Step 3: Implement, in this order**

1. **Trailing prose:** in `extractJson`, after slicing to the first bracket, balance-scan (`[`/`]`, `{`/`}`, respecting string literals) and slice to the matching close bracket.
2. **Trailing commas:** `s = s.replace(/,\s*([}\]])/g, '$1')` after the balance slice (string-literal-safe enough post-slice; keep the plain `JSON.parse` first and only apply the regex on a retry so valid JSON containing `",}"` inside strings is never touched).
3. **Answer resolution** in `parseExamQuestions` — resolve in priority order:
   ```ts
   const rawAns = o.correctIndex ?? o.answerIndex ?? o.correct ?? o.answer ?? o.correctAnswer;
   // 1. finite 0-3 number (incl. numeric strings) → as-is; exactly 4 → 3
   // 2. single letter A-D extracted from a string → letter index
   // 3. case-insensitive full match against the choices → that choice's index
   // else: skip the item (counted in `skipped`)
   ```
4. **5+ choices:** resolve the answer first against the full list; keep `choices.slice(0, 4)` only when the resolved index < 4.
5. **Skipped count:** each parser counts items it discarded; return `{ ok: true, items, skipped }`.

- [ ] **Step 4: Run tests — all PASS (new + 28 existing); `npm run check`; commit**

```bash
git add src/lib/import.ts src/lib/import.test.ts
git commit -m "feat(import): harden parser against messy AI output (trailing prose/commas, letter+text answers, skipped count)"
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

- [ ] **Step 3: Show the skipped count.** When `result.ok && result.skipped > 0`, render a warning line under the ready-message: `$t.importer.skippedCount(result.skipped)` — so dropped items are never invisible.

- [ ] **Step 4: i18n.** New keys in `importer`: `duplicate` ("Duplicate" / "ซ้ำ"), `selectedCount(n, total)`, `skippedCount(n)` ("n item(s) couldn't be read and were skipped" / Thai equivalent) — add to both `en.ts` and `th.ts`.

- [ ] **Step 5: Browser-verify** both import flows (mobile + desktop widths): paste JSON with a duplicate → it's flagged + unchecked; paste JSON with one broken item → skipped-count warning shows; import → only checked items land, single toast, list updates instantly.

- [ ] **Step 6: `npm run check` + `npx vitest run` → commit**

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
