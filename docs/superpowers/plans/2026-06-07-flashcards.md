# Flashcards (real SRS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the contentless per-topic SRS card with real front/back flashcards in a `/flashcards` sidebar page, one deck per topic, manually scheduled per deck.

**Architecture:** New `Flashcard` entity (deck = a topic's cards) + `Topic.nextStudyDate` for manual per-deck scheduling. A pure `flashcards.ts` helper computes deck state. Phase A is purely additive (nothing breaks); Phase B retires `srsCards` and re-points every consumer (readiness→coverage, scheduler, insights, analytics, dashboard, etc.) to deck due-dates. Shipped as two PRs.

**Tech Stack:** SvelteKit 2 + Svelte 4 idiom, TypeScript, vitest, Supabase (RLS). i18n via `$t`.

**Spec:** `docs/superpowers/specs/2026-06-07-flashcards-design.md`
**Branch:** `feat/flashcards` (off master, includes the #19 touch fix).

**Conventions every task:** `npm run check` 0 errors + `npx vitest run` pass after code steps. No hardcoded hex. Guest + auth parity. Migrations + merges are production actions — explicit go-ahead.

---

# PHASE A — Additive flashcards (ship as PR #1; nothing existing breaks)

## Task A1: `Flashcard` type + `Topic.nextStudyDate` + mappers

**Files:** `src/lib/types.ts`, `src/lib/data/mappers.ts`, `src/lib/data/mappers.test.ts`

- [ ] **Step 1: Failing tests** — append to `mappers.test.ts`:

```ts
import { flashcardFromRow, flashcardToRow } from '$lib/data/mappers';
import type { Flashcard } from '$lib/types';

describe('flashcard mapper', () => {
  it('round-trips a flashcard', () => {
    const f: Flashcard = { id: 'f1', userId: 'u', topicId: 't1', front: 'v=?', back: 'u+at', createdAt: '2026-06-07T00:00:00Z' };
    const row = flashcardToRow(f);
    expect(row.user_id).toBe('u');
    expect(row.topic_id).toBe('t1');
    expect(flashcardFromRow(row)).toEqual(f);
  });
});

describe('topic nextStudyDate', () => {
  it('round-trips next_study_date', () => {
    const t = { id: 't1', subjectId: 's1', name: 'K', orderIndex: 0, nextStudyDate: '2026-06-14' } as import('$lib/types').Topic;
    expect(topicToRow(t).next_study_date).toBe('2026-06-14');
    expect(topicFromRow(topicToRow(t)).nextStudyDate).toBe('2026-06-14');
  });
  it('legacy row → nextStudyDate undefined', () => {
    expect(topicFromRow({ id: 't', subject_id: 's', name: 'n', order_index: 0 }).nextStudyDate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run src/lib/data/mappers.test.ts`).

- [ ] **Step 3: Types** — in `types.ts`, add to `Topic` (after `note?`):

```ts
  nextStudyDate?: string;   // YYYY-MM-DD; the deck's manual next-study date
```

and a new interface:

```ts
export interface Flashcard {
  id: string;
  userId: string;
  topicId: string;
  front: string;
  back: string;
  createdAt: string;   // ISO
}
```

- [ ] **Step 4: Mappers** — in `mappers.ts`, extend the topic mappers and add flashcard mappers:

In `topicFromRow` add: `nextStudyDate: (r.next_study_date as string | null) ?? undefined,`
In `topicToRow` add: `next_study_date: t.nextStudyDate ?? null,`

Append:

```ts
export const flashcardFromRow = (r: Record<string, unknown>): Flashcard => ({
  id: r.id as string,
  userId: r.user_id as string,
  topicId: r.topic_id as string,
  front: r.front as string,
  back: r.back as string,
  createdAt: r.created_at as string,
});

export const flashcardToRow = (f: Flashcard): Record<string, unknown> => ({
  id: f.id,
  user_id: f.userId,
  topic_id: f.topicId,
  front: f.front,
  back: f.back,
  created_at: f.createdAt,
});
```

Add `Flashcard` to the `types` import at the top of `mappers.ts`.

- [ ] **Step 5: Run tests + check** → PASS, 0 errors.

- [ ] **Step 6: Commit** — `git commit -m "feat(flashcards): Flashcard type + topic nextStudyDate + mappers"`

## Task A2: deck-state helper `flashcards.ts`

**Files:** `src/lib/flashcards.ts` (new), `src/lib/flashcards.test.ts` (new)

- [ ] **Step 1: Failing tests** (`flashcards.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { deckState, type DeckState } from '$lib/flashcards';

const today = '2026-06-07';
describe('deckState', () => {
  it('empty when no cards', () => { expect(deckState(undefined, 0, today)).toBe('empty'); });
  it('new when cards but no date', () => { expect(deckState(undefined, 3, today)).toBe('new'); });
  it('due when date <= today', () => { expect(deckState('2026-06-07', 3, today)).toBe('due'); expect(deckState('2026-06-01', 3, today)).toBe('due'); });
  it('scheduled when date in future', () => { expect(deckState('2026-06-20', 3, today)).toBe('scheduled'); });
  it('isDeckDue true for new and due only', () => {
    expect(['new','due'] as DeckState[]).toContain(deckState(undefined, 1, today));
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (`flashcards.ts`):

```ts
export type DeckState = 'empty' | 'new' | 'due' | 'scheduled';

/** A topic is a deck. State from its card count and manual nextStudyDate. */
export function deckState(nextStudyDate: string | undefined, cardCount: number, today: string): DeckState {
  if (cardCount === 0) return 'empty';
  if (!nextStudyDate) return 'new';
  return nextStudyDate <= today ? 'due' : 'scheduled';
}

/** Decks needing study now: have cards and are new or due. */
export function isDeckDue(state: DeckState): boolean {
  return state === 'new' || state === 'due';
}

/** Preset next-study dates from today (YYYY-MM-DD). */
export function presetDate(today: string, days: number): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
```

- [ ] **Step 4: Run tests + check** → PASS, 0 errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(flashcards): deck-state helper"`

## Task A3: flashcards store + repo + loadData

**Files:** `src/lib/data/stores.ts`, `src/lib/data/entities.ts`, `src/lib/stores/data.ts`

- [ ] **Step 1: Store** — in `stores.ts` add import `Flashcard` and:

```ts
export const flashcards = writable<Flashcard[]>([]);
```

- [ ] **Step 2: Repo** — in `entities.ts`, import `flashcards` from stores and `flashcardFromRow, flashcardToRow` from mappers, then add (mirrors `examQuestionsRepo`):

```ts
export const flashcardsRepo = repo<Flashcard>({
  store: flashcards,
  lsKey: 'pulse.flashcards',
  table: 'flashcards',
  toRow: flashcardToRow,
  fromRow: flashcardFromRow,
  orderColumn: 'created_at',
  ascending: true,
  order: (a, b) => a.createdAt.localeCompare(b.createdAt),
});
```

Add `Flashcard` to the type import.

- [ ] **Step 3: data.ts** — re-export `flashcards` and add `flashcardsRepo.load()` to `loadData`'s `Promise.all`. Import `flashcardsRepo` from entities.

- [ ] **Step 4: check + tests** → 0 errors, pass.

- [ ] **Step 5: Commit** — `git commit -m "feat(flashcards): store + repo + loadData"`

## Task A4: Migration (PRODUCTION ACTION)

- [ ] **Step 1: SQL**

```sql
create table if not exists flashcards (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  topic_id uuid not null references topics(id) on delete cascade,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);
alter table flashcards enable row level security;
create policy "flashcards_owner" on flashcards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists flashcards_topic_id_idx on flashcards(topic_id);

alter table topics add column if not exists next_study_date date;
```

- [ ] **Step 2: GET GO-AHEAD**, then `apply_migration` (project `bzcanpehaoeminjbzpvq`, name `add_flashcards_and_topic_next_study_date`). Verify with `information_schema` that `flashcards` exists and `topics.next_study_date` is `date`.

- [ ] **Step 3: No repo commit** (schema only).

## Task A5: nav entry + i18n

**Files:** `Sidebar.svelte`, `MoreDrawer.svelte`, `en.ts`, `th.ts`

- [ ] **Step 1: nav key** — `en.ts` `nav`: add `flashcards: 'Flashcards',`; `th.ts` `nav`: add `flashcards: 'แฟลชการ์ด',`.

- [ ] **Step 2: Sidebar** — in the **Track** group `items` array, add:

```ts
{ key: 'flashcards', href: '/flashcards', d: 'M3 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3zM7 9h6M7 13h6' },
```

(`MoreDrawer` renders nav keys from a list — add `{ key: 'flashcards', href: '/flashcards' }` to its `items`.)

- [ ] **Step 3: flashcards page i18n namespace** — add a `flashcards` namespace to `en.ts` + `th.ts` (mirror) with keys used by Tasks A6–A8:

```ts
  flashcards: {
    title: 'Flashcards',
    dueToday: 'DUE TODAY',
    allDecks: 'ALL DECKS',
    cardsCount: (n: number) => `${n} card${n !== 1 ? 's' : ''}`,
    study: 'Study',
    stateNew: 'new',
    stateDue: 'due',
    nextOn: (d: string) => `Next ${d}`,
    emptyTitle: 'No flashcards yet',
    emptySub: 'Open a deck and add your first card.',
    deckEmpty: 'No cards in this deck yet.',
    addCard: 'Add card',
    front: 'Front',
    back: 'Back',
    frontPlaceholder: 'Question…',
    backPlaceholder: 'Answer…',
    save: 'Save card',
    editCard: 'Edit card',
    deleteCard: 'Delete card',
    deleteCardTitle: 'Delete this card?',
    reveal: 'Show answer',
    next: 'Next',
    finishTitle: 'See this deck again?',
    presetTomorrow: 'Tomorrow',
    preset3Days: 'In 3 days',
    presetWeek: 'In 1 week',
    presetPick: 'Pick a date',
    noSchedule: "Don't schedule",
    studyDone: 'Deck studied',
    back_: 'Back',
  },
```

Thai mirror (casual): `title:'แฟลชการ์ด', dueToday:'ครบกำหนดวันนี้', allDecks:'เด็คทั้งหมด', cardsCount:(n)=>`${n} การ์ด`, study:'เรียน', stateNew:'ใหม่', stateDue:'ครบกำหนด', nextOn:(d)=>`ครั้งหน้า ${d}`, emptyTitle:'ยังไม่มีแฟลชการ์ด', emptySub:'เปิดเด็คแล้วเพิ่มการ์ดแรก', deckEmpty:'ยังไม่มีการ์ดในเด็คนี้', addCard:'เพิ่มการ์ด', front:'หน้า', back:'หลัง', frontPlaceholder:'คำถาม…', backPlaceholder:'คำตอบ…', save:'บันทึกการ์ด', editCard:'แก้ไขการ์ด', deleteCard:'ลบการ์ด', deleteCardTitle:'ลบการ์ดนี้?', reveal:'แสดงคำตอบ', next:'ถัดไป', finishTitle:'ทบทวนเด็คนี้อีกเมื่อไหร่?', presetTomorrow:'พรุ่งนี้', preset3Days:'อีก 3 วัน', presetWeek:'อีก 1 สัปดาห์', presetPick:'เลือกวันที่', noSchedule:'ไม่กำหนด', studyDone:'เรียนเด็คเสร็จแล้ว', back_:'กลับ'`

- [ ] **Step 4: parity + check** → `npx vitest run src/lib/i18n` pass, 0 errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(flashcards): nav entry + i18n namespace"`

## Task A6: `/flashcards` deck-list page

**Files:** `src/routes/(app)/flashcards/+page.svelte` (new)

- [ ] **Step 1: Page** — standard page (onMount `loadData($auth)` + reactive). Build deck rows from `$topics` + `$flashcards` + `$subjects`, using `deckState` + `localDateStr(new Date())` for today. Sections: DUE TODAY (`isDeckDue(state)`), ALL DECKS (state !== 'empty') grouped by subject. Each row links to `/flashcards/{topic.id}` and has a **Study** button (also → `/flashcards/{topic.id}?study=1`, or a dedicated study route — Task A8 decides; default: deck detail hosts study). Show `cardsCount`, and state badge (`new`/`due`/`Next {date}` via `$fmt.date`). Empty state when no non-empty decks. Full code authored at execution against the New Page recipe; uses only `$t.flashcards.*` + tokens.

- [ ] **Step 2: check** → 0 errors. Browser: page renders, empty state shows for a fresh guest.

- [ ] **Step 3: Commit** — `git commit -m "feat(flashcards): deck list page"`

## Task A7: deck detail + card CRUD

**Files:** `src/routes/(app)/flashcards/[topicId]/+page.svelte` (new), a `FlashcardForm.svelte` component (`src/lib/components/flashcards/`)

- [ ] **Step 1:** Deck detail page: header (topic name + back), list of the topic's flashcards (front + back peek) each with edit/delete (delete via `ConfirmDialog` + `flashcardsRepo.remove`), and a `FlashcardForm` (front + back inputs, mirrors `ScoreForm`) that calls `flashcardsRepo.save({ id: newId(), userId: getAuthContext().userId, topicId, front, back, createdAt: new Date().toISOString() })`. Edit reuses the form with `initial`.

- [ ] **Step 2: check + browser** — add/edit/delete a card persists (guest).

- [ ] **Step 3: Commit** — `git commit -m "feat(flashcards): deck detail + card CRUD"`

## Task A8: study/flip flow

**Files:** deck detail page (or `src/lib/components/flashcards/StudyFlow.svelte`)

- [ ] **Step 1:** A **Study** entry (button on deck list + deck detail) opens the flip flow over the deck's cards (ordered by `createdAt`): show `front` → **Show answer** reveals `back` → **Next** → … last card → **"See this deck again?"** with `presetTomorrow`/`preset3Days`/`presetWeek`/`presetPick` (date input) → `topicsRepo.save({ ...topic, nextStudyDate: presetDate(today, n) })` (or the picked date), plus `noSchedule` (leaves date). Disable Study when the deck has 0 cards.

- [ ] **Step 2: check + browser** — study a deck, set "In 3 days", confirm the deck leaves DUE TODAY and shows `Next {date}`.

- [ ] **Step 3: Commit** — `git commit -m "feat(flashcards): study/flip flow + manual scheduling"`

## Task A9: Phase A finish

- [ ] **Step 1:** `npm run check` 0 errors; `npx vitest run` all pass.
- [ ] **Step 2:** Browser walkthrough (guest, EN + TH): create cards, study, schedule; nav entry works.
- [ ] **Step 3:** `superpowers:finishing-a-development-branch` → push `feat/flashcards`, open **PR #A**. Migration already applied (Task A4). **Merge needs go-ahead.** After merge, sync, and continue Phase B on a fresh branch `feat/flashcards-retire-srs` off the updated master.

---

# PHASE B — Retire old SRS + reconcile (ship as PR #2)

> Branch `feat/flashcards-retire-srs` off master after Phase A merges.

## Task B1: readiness → coverage

**Files:** `src/lib/data/readiness-util.ts` (new pure helper) or inline in `data.ts`; `src/lib/data/readiness.test.ts` (new)

- [ ] **Step 1: Failing test** — extract a pure `subjectCoverage(topicsForSubject)` returning `done/total` (0 if none):

```ts
import { subjectCoverage } from '$lib/data/readiness-util';
it('coverage = done / total', () => {
  expect(subjectCoverage([{done:true},{done:false}] as any)).toBe(0.5);
  expect(subjectCoverage([] as any)).toBe(0);
});
```

- [ ] **Step 2–3:** Implement `subjectCoverage`; in `readinessScore` (`data.ts`) replace the `srsScore`-based term with `0.4 * subjectCoverage(subjTopics) + 0.3 * hoursScore + 0.3 * examScore`, where `subjTopics = $topics.filter(t => t.subjectId === subj.id)`. Drop the `srsCards` dependency from the derived inputs.

- [ ] **Step 4:** tests + check pass. **Step 5:** commit `feat(readiness): coverage replaces retired SRS retention`.

## Task B2: `dueDecks` derived

**Files:** `src/lib/stores/data.ts`

- [ ] Add `export const dueDecks = derived([topics, flashcards], ([$t,$f]) => { const today = localDateStr(new Date()); const cnt = (id:string)=>$f.filter(c=>c.topicId===id).length; return $t.filter(tp => isDeckDue(deckState(tp.nextStudyDate, cnt(tp.id), today))); });` Import `deckState, isDeckDue` from `$lib/flashcards`. Commit `feat(flashcards): dueDecks derived`.

## Task B3: retire `srsCards`

**Files:** `entities.ts`, `stores.ts`, `data.ts`, `srs.ts` (delete), `subjects/[id]` (Task B5), mappers (leave card mapper, unused)

- [ ] Stop creating a card in `topicsRepo.create` (remove the `defaultCard`/srs-card creation + its rollback). Remove `srsRepo`, the `srsCards` store + re-export, the `dueCards` derived, and delete `src/lib/srs.ts` + `src/lib/srs.test.ts`. Replace `isDue` usages with `deckState`/date compare. `npm run check` will list every remaining importer — fix each. Commit `refactor: retire contentless srsCards + srs.ts`.

## Task B4: scheduler re-point

**Files:** `src/lib/scheduler.ts`, `src/lib/scheduler.test.ts`

- [ ] Drop `srsCards` from `ScheduleInput`. Compute `overdueCount`/`dueThisWeekCount` per subject from that subject's topics' `nextStudyDate` (overdue: `< todayStr`; due-this-week: `>= todayStr && < weekEndStr`; a `new` deck with cards counts as due-now). Update `scheduler.test.ts` fixtures (remove `srsCards`, add `topics` with `nextStudyDate`). Update the caller (`loadScheduleSlots`/schedule page) to stop passing `srsCards`. Commit `refactor(scheduler): deck due-dates replace srs cards`.

## Task B5: remove old review surfaces

**Files:** delete `src/routes/(app)/review/+page.svelte`; `src/routes/(app)/subjects/[id]/+page.svelte`; `dashboard/+page.svelte`

- [ ] Subject page: remove `reviewingCard` overlay + state, the **Review** button, the `srs-status` badge block + its styles, `handleReview`, `cardForTopic`, and the `reviewCard`/`isDue`/`srsRepo`/`srsCards` imports. Keep checkbox/note/rename/delete. Dashboard: remove the review-due card + any `dueCards` use. Delete the `/review` route. Remove now-unused `subjects` i18n review keys only if no other surface uses them (grep first). Commit `refactor: remove old review surfaces`.

## Task B6: insights → decks-due

**Files:** `src/lib/insights.ts`, `src/lib/insights.test.ts`

- [ ] Change the `srs-backlog` generator to read a `dueDeckCount` from the snapshot (add `dueDeckCount: number` to `InsightSnapshot`, fed by `dueDecks.length` in the `insights` derived). Re-word its keys (`backlogTitle`/`backlogBody`) to "decks due to study"; action → `/flashcards`. Update the snapshot construction in `data.ts` and the test. Commit `refactor(insights): srs backlog → decks due`.

## Task B7: analytics + TodaysPlan + subjects list + ScheduleSidebar

**Files:** `analytics/+page.svelte`, `TodaysPlan.svelte`, `subjects/+page.svelte`, `ScheduleSidebar.svelte`

- [ ] Re-point each from card-due to deck-due (`$dueDecks` / per-subject deck filter). Re-label Analytics "SRS HEALTH" → "FLASHCARDS" (update `analytics` i18n keys). For each: read the file, replace the `srsCards`/`dueCards` computation with the deck equivalent, keep the layout. Commit `refactor: re-point analytics/plan/subjects/sidebar to decks`.

## Task B8: guest cascade purge flashcards

**Files:** `src/lib/data/entities.ts`

- [ ] In `subjectsRepo.removeCascade` and `topicsRepo.removeCascade`, also drop flashcards for the removed topic(s) in guest mode: snapshot `flashcards`, filter out cards whose `topicId` is removed, `lsWrite('pulse.flashcards', …)`, and include in rollback. Auth relies on the FK `on delete cascade`. Commit `fix(flashcards): cascade-purge cards on topic/subject delete (guest)`.

## Task B9: Phase B finish

- [ ] `npm run check` 0 errors; `npx vitest run` all pass. Browser (guest, EN+TH): `/review` gone, dashboard review card gone, subject page clean, readiness reflects coverage, decks drive insights/analytics/schedule.
- [ ] CHANGELOG entry (note **readiness now uses coverage** and will read lower until topics are marked covered). Remove nothing from Active Plans (this wasn't a listed plan; add to changelog). Update CLAUDE.md Stores/Tables references (srs_cards retired; flashcards added).
- [ ] `finishing-a-development-branch` → push, **PR #B**; merge needs go-ahead; sync.

---

## Self-review notes
- **Spec coverage:** entity+migration (A1,A3,A4), nextStudyDate (A1), deck helper (A2), page/detail/study (A5–A8), readiness coverage (B1), dueDecks (B2), retire srsCards (B3), scheduler (B4), removed surfaces (B5), insights (B6), analytics/plan/subjects/sidebar (B7), guest cascade (B8). All spec sections covered.
- **Type consistency:** `Flashcard{front,back,topicId}`, `Topic.nextStudyDate`, `deckState`/`isDeckDue`/`presetDate`, `flashcardsRepo`, `dueDecks`, `subjectCoverage` are used consistently across tasks.
- **Phasing:** Phase A never removes anything, so the app is shippable after A. Phase B's first `npm run check` after Task B3 will enumerate every srsCards importer — B4–B8 clear them; finish B9 only when green.
- **Known consequence:** readiness drops for existing users until they mark topics covered (flagged in B9 changelog).
