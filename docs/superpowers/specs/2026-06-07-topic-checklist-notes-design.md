# Topic Checklist + Notes — Design

**Date:** 2026-06-07
**Status:** Approved (design), pending implementation plan
**Origin:** Reinterprets the deferred "exam label/tag on topics" idea (surfaced 2026-06-04). The exam high-yield star is **dropped** in favour of this checklist + notes direction.

## 1. Overview

Add two lightweight, per-topic additions to the **subject detail page** (`/subjects/[id]`) topic list:

1. A **"covered" checkbox** — a simple tick to track what you've studied.
2. A **short note** under each topic — e.g. *"watch unit conversions"*.

The existing **spaced-review / SRS system is unchanged**: every topic keeps its hidden review card, its due-date status (`New` / `Due {date}` / `Due today`), and its Review button. The checkbox is purely a personal "covered" marker and does **not** affect review scheduling. A checked topic stays in review.

This is small and self-contained: two optional fields on `Topic`, two UI controls on one page, one migration, mapper updates, a couple of i18n keys, one mapper test.

## 2. Goals / Non-goals

**Goals**
- Toggle a topic as covered (checkbox), persisted in guest and auth modes.
- Add/edit/clear a short free-text note per topic, shown under its name.
- Zero change to SRS scheduling, the Review flow, or topic order.

**Non-goals (YAGNI)**
- No filtering or sorting by "done".
- No strikethrough / hiding of covered topics (they stay fully visible and reviewable).
- No effect on readiness, scheduling, analytics, or insights.
- No exam high-yield star (dropped), no rich-text notes, no multiple notes.

## 3. Data model

Extend `Topic` (`src/lib/types.ts`) with two optional fields:

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

Both optional so existing in-memory/localStorage topics remain valid.

## 4. Persistence

### 4.1 Mapper (`src/lib/data/mappers.ts`)

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
  name: t.name,
  order_index: t.orderIndex,
  done: t.done ?? false,
  note: t.note ?? null,
});
```

`user_id` continues to be injected by `topicsRepo.save`/`create` (unchanged).

### 4.2 Guest mode

The local adapter stores the whole camelCase `Topic`, so `done`/`note` persist automatically — **no migration needed for guest**.

### 4.3 Migration (auth only) — production action

Add two columns to `topics`:

```sql
alter table topics
  add column if not exists done boolean not null default false,
  add column if not exists note text;
```

`default false` makes every existing topic "not covered"; `note` is nullable (no note). RLS unchanged (policy already `auth.uid() = user_id`). **Applying to prod requires explicit user go-ahead** (per CLAUDE.md).

## 5. UI — `/subjects/[id]` topic row

Current row: `[name | srs-status] … [review?] [edit] [delete]`. Two additions:

### 5.1 Covered checkbox (leading)

A leading checkbox button at the start of each `.topic-row`. Tap toggles `done`:

```ts
function toggleDone(topic: Topic) {
  topicsRepo.save({ ...topic, done: !topic.done });
}
```

- Unchecked = empty box outline (`var(--muted)`); checked = filled box with a check (`var(--primary)`).
- **Filled-checkbox-only style:** the topic name stays normal weight/colour when done (covered topics must remain clearly active in review).
- Hidden while that topic is in inline-rename mode (to avoid a crowded edit row).
- Write-through via `topicsRepo.save`; the bound store updates the row.

### 5.2 Note — separate affordance

A small **note icon button** in the row's action cluster (distinct from the rename pencil):

- Outline note icon when the topic has no note; filled/accented when a note exists (so you can see at a glance which topics carry notes).
- Tapping enters an **inline note editor** for that topic only — a text input below the name, mirroring the existing inline-rename pattern (a `editingNoteId` + `editNoteText` pair, analogous to `editingTopicId`/`editTopicName`). Enter or blur saves; Escape cancels:

```ts
function saveNote(topic: Topic) {
  const note = editNoteText.trim();
  topicsRepo.save({ ...topic, note: note || undefined });
  editingNoteId = null;
}
```

- When a note exists and the row is not being edited, it renders under the topic name as small muted text (`.topic-note`, `font-size: 12px; color: var(--muted)`), indented under the name.
- Saving an empty note clears it (`note: undefined`).

No new CSS token is introduced; reuse `--primary`, `--muted`, `--border`.

## 6. i18n

Add to the `subjects` namespace (en + th), casual Thai:

- `markCovered` / `unmarkCovered` — checkbox aria-labels ("Mark as covered" / "Mark as not covered").
- `addNote` / `editNote` — note button aria-label ("Add note" / "Edit note").
- `notePlaceholder` — input placeholder ("Add a note…").

The en/th parity guard test enforces key+type parity automatically.

## 7. Testing

`src/lib/data/mappers.test.ts` (already exists — extend it):

- `topicToRow(topicFromRow(row))` round-trips `done` and `note`.
- A legacy row missing both columns (`{ id, subject_id, name, order_index }`) maps to `done: false`, `note: undefined`.
- `topicToRow` of a topic with no `done`/`note` emits `done: false`, `note: null`.

Browser-verify in guest mode: toggle a checkbox and add a note, reload, confirm both persist.

## 8. File summary

**Modified**
- `src/lib/types.ts` — add `done?`, `note?` to `Topic`.
- `src/lib/data/mappers.ts` — map the two columns both ways.
- `src/routes/(app)/subjects/[id]/+page.svelte` — checkbox toggle, note button + inline editor, note display.
- `src/lib/i18n/en.ts` + `src/lib/i18n/th.ts` — 5 `subjects` keys.
- `src/lib/data/mappers.test.ts` — add topic round-trip tests (file exists).

**Migration**
- Supabase: `alter table topics add column done…, add column note…` — applied to prod only after explicit go-ahead.

**Unchanged** — SRS (`srs.ts`, `srsRepo`), review flow, topic order, readiness/insights/schedule, nav.

## 9. Verification

- `npm run check` → 0 type errors.
- `npx vitest run` → all pass incl. mapper round-trip + i18n parity.
- Guest browser check: checkbox + note persist across reload; covered topics still show review status and Review button.
