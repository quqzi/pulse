# Topic Checklist + Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-topic "covered" checkbox and a short note to the subject detail page, without changing the SRS/review system.

**Architecture:** Two optional fields on `Topic` (`done`, `note`) round-tripped through the topic mapper; UI on `/subjects/[id]` adds a leading checkbox (toggles `done` via `topicsRepo.save`) and a separate note button that opens an inline note editor mirroring the existing rename pattern. Guest mode persists automatically; auth needs a 2-column migration.

**Tech Stack:** SvelteKit 2 + Svelte 4 idiom, TypeScript, vitest, Supabase (Postgres + RLS). i18n via `$t`.

**Spec:** `docs/superpowers/specs/2026-06-07-topic-checklist-notes-design.md`
**Branch:** `feat/topic-checklist-notes` (already created off merged master).

**Conventions for every task:** after code steps `npm run check` must be 0 errors and `npx vitest run` must pass. No hardcoded hex (CSS tokens only). SRS/review code is untouched.

---

## File structure

**Modified**
- `src/lib/types.ts` — add `done?`, `note?` to `Topic`.
- `src/lib/data/mappers.ts` — `topicFromRow`/`topicToRow` map the two columns.
- `src/lib/data/mappers.test.ts` — topic round-trip tests (file exists).
- `src/lib/i18n/en.ts` + `src/lib/i18n/th.ts` — 5 `subjects` keys.
- `src/routes/(app)/subjects/[id]/+page.svelte` — checkbox + note UI.

**Migration** — Supabase `topics` table (production action).

---

## Task 1: Topic fields + mapper round-trip

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data/mappers.ts`
- Test: `src/lib/data/mappers.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/lib/data/mappers.test.ts`:

```ts
import { topicFromRow, topicToRow } from '$lib/data/mappers';
import type { Topic } from '$lib/types';

describe('topic mapper', () => {
  it('round-trips done and note', () => {
    const t: Topic = { id: 't1', subjectId: 's1', name: 'Kinematics', orderIndex: 0, done: true, note: 'watch units' };
    const row = topicToRow(t);
    expect(row.done).toBe(true);
    expect(row.note).toBe('watch units');
    expect(topicFromRow(row)).toEqual(t);
  });

  it('defaults a legacy row with no done/note columns', () => {
    const row = { id: 't1', subject_id: 's1', name: 'Kinematics', order_index: 0 };
    expect(topicFromRow(row)).toEqual({ id: 't1', subjectId: 's1', name: 'Kinematics', orderIndex: 0, done: false, note: undefined });
  });

  it('toRow emits done:false and note:null when absent', () => {
    const t: Topic = { id: 't1', subjectId: 's1', name: 'Kinematics', orderIndex: 0 };
    const row = topicToRow(t);
    expect(row.done).toBe(false);
    expect(row.note).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/data/mappers.test.ts`
Expected: FAIL — `topicToRow` doesn't emit `done`/`note` yet (and `Topic` has no such fields → type error).

- [ ] **Step 3: Add the Topic fields** — in `src/lib/types.ts`, replace the `Topic` interface:

```ts
export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  orderIndex: number;
  done?: boolean;   // covered checkbox; absent/false = not covered
  note?: string;    // short free-text note; absent/'' = no note
}
```

- [ ] **Step 4: Update the mapper** — in `src/lib/data/mappers.ts`, replace `topicFromRow` and `topicToRow`:

```ts
export const topicFromRow = (r: Record<string, unknown>): Topic => ({
  id: r.id as string,
  subjectId: r.subject_id as string,
  name: r.name as string,
  orderIndex: r.order_index as number,
  done: (r.done as boolean | null) ?? false,
  note: (r.note as string | null) ?? undefined,
});

export const topicToRow = (t: Topic): Record<string, unknown> => ({
  id: t.id,
  subject_id: t.subjectId,
  // user_id is injected by topicsRepo.save/create (Topic has no userId field; guest rows never carry it).
  name: t.name,
  order_index: t.orderIndex,
  done: t.done ?? false,
  note: t.note ?? null,
});
```

- [ ] **Step 5: Run tests + type-check**

Run: `npx vitest run src/lib/data/mappers.test.ts` → PASS (4 tests in file).
Run: `npm run check` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/data/mappers.ts src/lib/data/mappers.test.ts
git commit -m "feat(topics): add done + note fields with mapper round-trip"
```

---

## Task 2: i18n keys

**Files:**
- Modify: `src/lib/i18n/en.ts` (subjects namespace)
- Modify: `src/lib/i18n/th.ts` (subjects namespace)

- [ ] **Step 1: Add keys to `en.ts`** — inside the `subjects: { … }` block, after `subjectNamePlaceholder: 'Subject name…',`, add:

```ts
    markCovered: 'Mark as covered',
    unmarkCovered: 'Mark as not covered',
    addNote: 'Add note',
    editNote: 'Edit note',
    notePlaceholder: 'Add a note…',
```

- [ ] **Step 2: Mirror in `th.ts`** — inside the `subjects: { … }` block, after `subjectNamePlaceholder: 'ชื่อวิชา…',`, add:

```ts
    markCovered: 'ทำเครื่องหมายว่าเรียนแล้ว',
    unmarkCovered: 'ยกเลิกเครื่องหมายว่าเรียนแล้ว',
    addNote: 'เพิ่มโน้ต',
    editNote: 'แก้ไขโน้ต',
    notePlaceholder: 'เพิ่มโน้ต…',
```

> Both files must add the same 5 keys; the order within the block doesn't need to match, but the key set must. If `subjectNamePlaceholder` is not the last key in either block, insert anywhere inside the `subjects` block — just keep en and th in sync.

- [ ] **Step 3: Verify parity + types**

Run: `npx vitest run src/lib/i18n` → 5 pass.
Run: `npm run check` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat(i18n): subjects keys for topic covered + notes"
```

---

## Task 3: Covered checkbox

**Files:**
- Modify: `src/routes/(app)/subjects/[id]/+page.svelte`

- [ ] **Step 1: Add the toggle handler** — in the `<script>`, after `cancelEditTopic()` (around line 83), add:

```ts
  async function toggleDone(topic: import('$lib/types').Topic) {
    await topicsRepo.save({ ...topic, done: !topic.done });
  }
```

- [ ] **Step 2: Add the leading checkbox** — in the topic row markup, the row currently starts:

```svelte
          <div class="topic-row" class:divider={i > 0}>
            <div class="topic-info">
```

Insert the checkbox button as the first child of `.topic-row`, before `.topic-info`:

```svelte
          <div class="topic-row" class:divider={i > 0}>
            <button
              class="done-checkbox"
              class:checked={topic.done}
              on:click={() => toggleDone(topic)}
              aria-label={topic.done ? $t.subjects.unmarkCovered : $t.subjects.markCovered}
            >
              {#if topic.done}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
                  <path d="M8 12l3 3 5-6" stroke="var(--bg)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2" fill="none" />
                </svg>
              {/if}
            </button>
            <div class="topic-info">
```

> The check mark uses `stroke="var(--bg)"` on a `fill="currentColor"` (primary) box — never `#fff` — per the "text invisible on `--primary`" gotcha.

- [ ] **Step 3: Add checkbox styles** — in the `<style>` block, after the `.topic-row.divider` rule, add:

```css
  .done-checkbox {
    width: 28px; height: 28px; border-radius: 8px; border: none;
    background: transparent; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .done-checkbox.checked { color: var(--primary); }
  .done-checkbox:hover { background: var(--bg3); }
  @media (max-width: 768px) { .done-checkbox { min-width: 44px; min-height: 44px; } }
```

- [ ] **Step 4: Type-check**

Run: `npm run check` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/'(app)'/subjects/'[id]'/+page.svelte
git commit -m "feat(topics): covered checkbox on the subject detail page"
```

---

## Task 4: Note button + inline editor + display

**Files:**
- Modify: `src/routes/(app)/subjects/[id]/+page.svelte`

- [ ] **Step 1: Add note state + handlers** — in the `<script>`, after the `toggleDone` function from Task 3, add:

```ts
  let editingNoteId: string | null = null;
  let editNoteText = '';

  function startEditNote(topic: import('$lib/types').Topic) {
    editingNoteId = topic.id;
    editNoteText = topic.note ?? '';
  }

  async function saveEditNote(topic: import('$lib/types').Topic) {
    const note = editNoteText.trim();
    if ((note || undefined) === (topic.note ?? undefined)) {
      editingNoteId = null;
      return;
    }
    await topicsRepo.save({ ...topic, note: note || undefined });
    editingNoteId = null;
  }

  function cancelEditNote() {
    editingNoteId = null;
  }
```

- [ ] **Step 2: Add the note display + inline editor inside `.topic-info`** — the `.topic-info` block currently ends after the SRS status:

```svelte
              {#if card && editingTopicId !== topic.id}
                <span class="srs-status" class:due={isDue(card.dueDate)} class:reviewed={card.reps > 0}>
                  …
                </span>
              {/if}
            </div>
```

Insert the note elements just before the closing `</div>` of `.topic-info`:

```svelte
              {#if editingNoteId === topic.id}
                <input
                  class="note-input"
                  bind:value={editNoteText}
                  placeholder={$t.subjects.notePlaceholder}
                  on:keydown={e => {
                    if (e.key === 'Enter') saveEditNote(topic);
                    if (e.key === 'Escape') cancelEditNote();
                  }}
                  on:blur={() => saveEditNote(topic)}
                />
              {:else if topic.note}
                <p class="topic-note">{topic.note}</p>
              {/if}
            </div>
```

- [ ] **Step 3: Add the note button to `.topic-actions`** — the actions cluster currently starts with the review button then the edit pencil:

```svelte
            <div class="topic-actions">
              {#if card && isDue(card.dueDate) && editingTopicId !== topic.id}
                <button class="review-btn" …>{$t.subjects.review}</button>
              {/if}
              {#if editingTopicId !== topic.id}
                <button class="icon-btn edit-icon" on:click={() => startEditTopic(topic)} aria-label={$t.subjects.editTopicLabel}>
```

Insert the note button as the first item inside the `{#if editingTopicId !== topic.id}` block, before the edit pencil button:

```svelte
              {#if editingTopicId !== topic.id}
                <button
                  class="icon-btn note-btn"
                  class:has-note={!!topic.note}
                  on:click={() => startEditNote(topic)}
                  aria-label={topic.note ? $t.subjects.editNote : $t.subjects.addNote}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 13h6M9 17h4" />
                  </svg>
                </button>
                <button class="icon-btn edit-icon" on:click={() => startEditTopic(topic)} aria-label={$t.subjects.editTopicLabel}>
```

> Leave the rest of the edit-pencil button and the delete button exactly as they are; you are only adding the note button immediately before the existing edit pencil.

- [ ] **Step 4: Add note styles** — in the `<style>` block, after the `.done-checkbox` rules from Task 3, add:

```css
  .topic-note { font-size: 12px; color: var(--muted); margin: 2px 0 0; line-height: 1.4; }
  .note-input {
    width: 100%; margin-top: 4px; padding: 4px 8px;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--text); font-family: inherit; font-size: 12px; outline: none;
  }
  .note-input:focus { border-color: var(--primary); }
  .note-btn.has-note { color: var(--primary); }
```

- [ ] **Step 5: Type-check + full tests**

Run: `npm run check` → 0 errors.
Run: `npx vitest run` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/'(app)'/subjects/'[id]'/+page.svelte
git commit -m "feat(topics): per-topic note with inline editor + display"
```

---

## Task 5: Supabase migration (production action)

**Files:**
- Supabase `topics` table.

- [ ] **Step 1: Confirm guest mode already works** (no migration needed there) by the browser check in Task 6; the migration is for authenticated users only.

- [ ] **Step 2: Prepare the migration SQL**

```sql
alter table topics
  add column if not exists done boolean not null default false,
  add column if not exists note text;
```

This sets every existing topic to not-covered (`done = false`) and no note (`note = null`). RLS is unchanged (existing policy `auth.uid() = user_id` still covers all columns).

- [ ] **Step 3: GET EXPLICIT USER GO-AHEAD, then apply**

Per CLAUDE.md, applying a migration to prod is a production action. State the SQL to the user and wait for an explicit OK. Then apply via the Supabase MCP (`supabase:supabase`) / migration tool. Verify the columns exist:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'topics' and column_name in ('done', 'note');
```

Expected: `done | boolean | false`, `note | text | (null)`.

- [ ] **Step 4: No commit** (schema change only; nothing in the repo to commit for this task).

---

## Task 6: Browser verification + docs + finish

**Files:**
- Modify: `docs/CHANGELOG.md`, `CLAUDE.md`.

- [ ] **Step 1: Guest browser check (English)**

Start `npm run dev`. As a guest, open a subject with topics. Confirm:
- tapping the checkbox toggles a filled/empty box and the topic name stays normal weight;
- the SRS status + Review button are unchanged for covered topics;
- tapping the note button opens an inline input; typing + Enter saves; the note shows under the name in muted text; the note button shows the accented (has-note) state;
- reload the page → both the checkbox state and the note persist (guest localStorage).

- [ ] **Step 2: Thai check**

Set `pulse_settings.lang = 'th'` in localStorage, reload, confirm the checkbox/note aria-labels and the note placeholder render Thai (inspect the note input `placeholder` and button `aria-label`).

- [ ] **Step 3: Update docs**

Add a CHANGELOG entry at the top of `docs/CHANGELOG.md`:

```
- `docs/superpowers/plans/2026-06-07-topic-checklist-notes.md` — Topic checklist + notes: added a per-topic "covered" checkbox and a short note on the subject detail page. Two optional `Topic` fields (`done`, `note`) round-tripped through the topic mapper (round-trip + legacy-default tests); guest persists automatically, auth via a `topics` migration (`done boolean not null default false`, `note text`). UI: leading checkbox toggling `done` via `topicsRepo.save` (name unchanged), separate note button → inline note editor mirroring the rename pattern, note shown under the name. SRS/review system untouched. 5 subjects i18n keys (en/th). 0 type errors; mapper + parity tests pass; guest browser-verified.
```

Remove the "Exam label / tag on topics under a subject (deferred …)" line from `CLAUDE.md` → Active Plans → Planned (it's now delivered as this feature), and bump the changelog count in the Completed pointer.

- [ ] **Step 4: Final verify + commit**

Run: `npm run check` → 0 errors. Run: `npx vitest run` → all pass.

```bash
git add docs/CHANGELOG.md CLAUDE.md
git commit -m "docs: log topic checklist + notes; clear deferred item"
```

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch`: push `feat/topic-checklist-notes`, open a PR. **Merging to `master` and applying the migration are production actions — get explicit user go-ahead** for each. After merge, run the `git -C` fast-forward sync ritual.

---

## Self-review notes

- **Spec coverage:** data model (Task 1), mapper + tests (Task 1), i18n (Task 2), checkbox UI (Task 3), note UI (Task 4), migration (Task 5), guest/auth + browser + docs + finish (Task 6). Every spec section maps to a task.
- **Type consistency:** `done?: boolean` / `note?: string` field names are identical across types, mapper, tests, and UI handlers (`toggleDone`, `saveEditNote` use `topic.done` / `topic.note`). i18n keys (`markCovered`, `unmarkCovered`, `addNote`, `editNote`, `notePlaceholder`) match between Task 2 and the markup in Tasks 3–4.
- **No SRS change:** `srs.ts`/`srsRepo`/review flow are not touched; the checkbox/note write through `topicsRepo.save` which already preserves all other Topic fields via `{ ...topic }`.
- **Note clearing:** saving an empty note stores `note: undefined` (→ `null` row), and `saveEditNote` no-ops when unchanged.
