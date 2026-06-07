# Flashcards (real SRS) — Design

**Date:** 2026-06-07
**Status:** Approved (design), pending implementation plan
**Supersedes:** the contentless per-topic SRS card + the `/review` flow. Reframes the deferred "make review useful" thread.

## 1. Overview

Replace the contentless per-topic "review card" with **real flashcards** — front/back Q&A — so reviewing is genuine retrieval practice instead of self-rating. Flashcards live in a dedicated **`/flashcards`** sidebar page. Each **topic is a deck**; the user **manually sets a per-deck "next study" date** (no SM-2 algorithm). The old per-card SRS machinery and every surface that read it are retired or re-pointed to the new deck model.

This reshapes a core system: the old `srsCards` fed the readiness score, the auto-scheduler, the dashboard "review due" nudge, Insights, Analytics, TodaysPlan, the subjects list, and the schedule sidebar. The design retires `srsCards` and re-points each consumer to **deck due-dates** (`topic.nextStudyDate`), and redefines the readiness "retention" component as **coverage**.

Implementation is **phased** so the app stays green:
- **Phase A (additive):** Flashcard entity + `topic.nextStudyDate` + `/flashcards` page + study flow + nav. Nothing existing breaks.
- **Phase B (retire + reconcile):** remove `/review`, the dashboard review card, and the subject-page review; retire `srsCards`; re-point readiness/scheduler/Insights/Analytics/TodaysPlan/subjects-list/ScheduleSidebar.

## 2. Goals / Non-goals

**Goals**
- Real flashcards (front/back) organized as one deck per topic.
- A single `/flashcards` study destination in the sidebar.
- Manual per-deck scheduling: the user picks when a deck is next due.
- Retire the old contentless SRS cleanly; keep guest + auth parity.
- Redefine readiness without per-card ease.

**Non-goals (YAGNI)**
- No SM-2 / automatic interval scheduling (explicitly replaced by manual dates).
- No per-card scheduling (scheduling is per deck/topic only).
- No card media, tags, rich text, or import/export.
- No migration of old contentless cards into flashcards (they had no content).

## 3. Data model

### 3.1 New `Flashcard`
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
- Table `flashcards` (RLS `auth.uid() = user_id`, index on `topic_id`).
- Mapper pair `flashcardFromRow`/`flashcardToRow`; plain `repo()` (`lsKey: 'pulse.flashcards'`, `table: 'flashcards'`); store `flashcards`.
- **Deck = the flashcards whose `topicId` matches a topic.**

### 3.2 `Topic.nextStudyDate`
```ts
nextStudyDate?: string;   // YYYY-MM-DD; the deck's manual next-study date
```
- New `topics.next_study_date date` column (joins `done`/`note` added earlier).
- Deck states: **new** (has cards, no `nextStudyDate`), **due** (`nextStudyDate ≤ today`), **scheduled** (`nextStudyDate > today`), **empty** (no cards).

### 3.3 Retire `srsCards`
- Stop creating cards in `topicsRepo.create`; remove `srsRepo`, the `srsCards` store, `dueCards` derived, and `srs.ts` (`reviewCard`/`defaultCard`/`isDue` — `isDue` logic moves to a tiny deck helper). `srs_cards` table is left orphaned (drop later; not destructive now).

## 4. `/flashcards` page (new, sidebar Track group)

- **Nav:** add `{ label: Flashcards, href: '/flashcards', d: '<svg>' }` to `Sidebar.svelte` Track group + `MoreDrawer.svelte`. i18n `nav.flashcards`.
- **Layout:**
  - **DUE TODAY** — decks that are *due* or *new* (have cards, need study). Each row: subject symbol · topic name · card count · **[Study]**.
  - **ALL DECKS** — grouped by subject → topic; every topic that has ≥1 card. Row shows card count + next-study date (or "new"/"due") + **[Study]**, and tapping the row (not Study) opens the **deck detail**.
  - Empty state when no topic has any cards: "No flashcards yet — open a deck and add some" → links to a subject, or explains adding via deck detail.
- **Deck detail** (`/flashcards/[topicId]` or an in-page panel — plan picks; default: route `/flashcards/[topicId]`):
  - Lists the deck's flashcards (front shown, back peek), each with edit/delete.
  - **Add card** form: `front` + `back` text inputs (mirrors `ScoreForm`/exam-question form style). Saves via `flashcardsRepo.save`.
- **Study flow** (from any [Study]):
  - Flip through the deck's cards in order: show **front** → tap reveals **back** → **Next** → … On the last card, show **"See this deck again?"** with presets **Tomorrow (+1)** / **3 days (+3)** / **1 week (+7)** / **Pick date** → writes `topic.nextStudyDate` via `topicsRepo.save`. A "Done, don't schedule" option leaves `nextStudyDate` unchanged.
  - Empty deck can't be studied (Study hidden/disabled until ≥1 card).

## 5. Removed surfaces (Phase B)

- **`/review/+page.svelte`** route — deleted.
- **Subject-page review** on `/subjects/[id]`: the `reviewingCard` overlay, the **Review** button, the **`srs-status`** badge ("New/Due today/Due {date}"), and the `handleReview`/`cardForTopic`/`reviewCard` imports. The subject page keeps the topic **checklist + notes + rename/delete**. *(Optional nicety: a small "N cards ›" per topic linking to its deck — deferred unless trivial.)*
- **Dashboard "review due"** card and any `dueCards`/review CTA.

## 6. Reconciled dependents (Phase B)

All shift from "cards due (`card.dueDate`)" to "decks due (`topic.nextStudyDate`)". A shared helper `deckDue(topic, today)` / a derived `dueDecks` store centralizes it.

- **`readinessScore`** — replace the 0.4 SRS-ease term with **coverage**: per subject, `coverage = topicsDone / topicsTotal` (0 if no topics). New blend: `0.4*coverage + 0.3*hoursScore + 0.3*examScore`. (`topicsDone` = topics with `done === true`.) This makes the "covered" checkbox meaningful.
- **Insights `srs-backlog`** generator → **decks-due**: fires when the number of due/new decks ≥ threshold; title/body re-worded ("N decks due to study"). Keeps its `/flashcards` action.
- **Analytics "SRS HEALTH"** card → **"FLASHCARDS"**: show due-decks vs total-cards (re-point, re-label; i18n keys updated).
- **TodaysPlan**, **subjects list** ("due today" per subject), **ScheduleSidebar** ("SRS due this week") → compute from `dueDecks` (topics with `nextStudyDate ≤ today` for that subject/week) instead of cards.
- **`scheduler.ts`** — `overdueCount`/`dueThisWeekCount` per subject now come from each subject's topics' `nextStudyDate` (deck due/overdue), not `srsCards`. The `ScheduleInput.srsCards` field is dropped; `topics` already carries the dates.

## 7. Migration / back-compat (production action)

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
create policy "flashcards_owner" on flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists flashcards_topic_id_idx on flashcards(topic_id);

alter table topics add column if not exists next_study_date date;
```
- `srs_cards` left in place (orphaned) — no destructive drop now.
- **Guest:** new `pulse.flashcards` key + `topic.nextStudyDate`; stop reading/writing `pulse.srsCards`.
- **Existing users:** start with empty decks (the old cards had no content, nothing to migrate). `nextStudyDate` empty → decks read as "new" once cards are added.
- Schema changes applied to prod only after explicit go-ahead.

## 8. Testing

- **Mappers:** `flashcardFromRow`/`flashcardToRow` round-trip; `topicFromRow`/`topicToRow` round-trip `nextStudyDate` (incl. legacy null → undefined).
- **Deck helper:** `deckDue`/`dueDecks` — new (no date, has cards) ⇒ due; future date ⇒ not due; past/today ⇒ due; no cards ⇒ not a deck.
- **`readinessScore`:** coverage blend — all-done subject scores higher than none-done with equal hours/exam; no-topic subject = 0 coverage.
- **`scheduler`:** overdue/due-this-week counts derive from `topic.nextStudyDate` (update existing scheduler tests; drop `srsCards` from fixtures).
- Browser (guest): add cards to a deck, study + set next date, deck moves out of DUE TODAY; verify in English + Thai; confirm `/review` and the dashboard review card are gone; readiness reflects coverage.

## 9. File summary

**New**
- `src/lib/components/flashcards/…` (deck list rows, card form, study flow) + `src/routes/(app)/flashcards/+page.svelte` (+ deck detail route).
- `flashcards` entity: `stores.ts`, `mappers.ts`, `entities.ts`, store re-export + `loadData`.

**Modified (Phase B)**
- `types.ts` (`Flashcard`, `Topic.nextStudyDate`), `data.ts` (`dueDecks`, `readinessScore`, drop `dueCards`), `scheduler.ts`, `insights.ts`, `Sidebar.svelte`/`MoreDrawer.svelte`, `analytics`, `TodaysPlan.svelte`, `subjects/+page.svelte`, `ScheduleSidebar.svelte`, `dashboard/+page.svelte`, `subjects/[id]/+page.svelte`, i18n (`en.ts`/`th.ts`).

**Removed**
- `src/routes/(app)/review/+page.svelte`, `srs.ts`, `srsRepo`, `srsCards` store, `dueCards`.

## 10. Verification
- `npm run check` 0 errors; `npx vitest run` all pass (new + updated tests).
- Guest browser walkthrough of the full flashcards lifecycle in English + Thai; confirm removed surfaces are gone and dependents read decks.
