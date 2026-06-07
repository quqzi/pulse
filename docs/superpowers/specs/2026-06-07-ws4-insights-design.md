# WS4 — Insights — Design

**Date:** 2026-06-07
**Status:** Approved (design), pending implementation plan
**Workstream:** WS4 (Features) — see `docs/superpowers/specs/2026-05-29-pulse-roadmap-and-foundation-design.md`

## 1. Overview

Replace the `/insights` stub (currently a "Coming soon" placeholder) with a real
**study-coach feed**: a prioritized list of natural-language insight cards, each an
observation plus a recommended action, derived from the user's existing study data.

Insights is deliberately **distinct** from the two existing analytical pages:

- **Analytics** = raw charts (study trend, week-by-subject, SRS health).
- **Journey** = history (16-week heatmap + session timeline).
- **Insights** = *derived, actionable observations* ("Chemistry is your weakest area → schedule a session"). It answers "what should I do next?", not "what are my numbers?".

Everything is computed client-side from stores already loaded by `loadData()`, so
Insights behaves **identically in guest and authenticated mode** and needs **no new
schema, no migration, no repo**.

## 2. Goals / Non-goals

**Goals**
- A severity-ranked, capped feed of insight cards with optional action links.
- Each insight is *gated*: it only appears when there is enough data to be meaningful.
- Pure, individually unit-testable insight generators (mirrors `readinessScore`, `srs.ts`).
- Full i18n (English + casual Thai), via the existing `insights` namespace.
- A friendly empty state for the cold-start case.

**Non-goals (YAGNI)**
- No persisted/server-computed insights — all client-derivable.
- No new charts (that is Analytics' job).
- No insight dismissal/snooze, no history of past insights, no notifications.
- No ML/recommendation model — deterministic rules only.

## 3. Architecture

### 3.1 `src/lib/insights.ts` (new, pure)

The computation core. No Svelte, no stores imported — pure functions over a snapshot,
so it is trivially unit-testable (same pattern as `srs.ts`).

```ts
export type InsightSeverity = 'high' | 'medium' | 'positive';

export interface InsightAction {
  labelKey: keyof I18n['insights'];   // resolved to $t at render
  href: string;
}

export interface Insight {
  id: string;                 // stable per-kind id, e.g. 'weakest-subject'
  severity: InsightSeverity;
  priority: number;           // stable tiebreaker within a severity band
  icon: string;               // emoji or token; rendered as-is
  // i18n: the card resolves these against $t at render time, never bakes strings.
  titleKey: keyof I18n['insights'];
  titleArgs?: (string | number)[];
  bodyKey?: keyof I18n['insights'];
  bodyArgs?: (string | number)[];
  action?: InsightAction;
}

export interface InsightSnapshot {
  subjects: Subject[];
  topics: Topic[];
  srsCards: SrsCard[];
  sessions: StudySession[];
  scores: MockScore[];
  examSessions: ExamSession[];
  readiness: { overall: number; bySubject: Record<string, number> };
  streak: number;
  dailyGoalHours: number;
  examDate: string | null;
  today: string;              // 'YYYY-MM-DD', injected (no Date.now() inside generators → testable)
}

type Generator = (s: InsightSnapshot) => Insight | null;
export const GENERATORS: Generator[] = [ /* see §4 */ ];

/** Run all generators, drop nulls, sort by severity band then priority, cap. */
export function computeInsights(s: InsightSnapshot, cap = 7): Insight[];
```

**Title/body as keys, not strings.** Generators return i18n *key references plus
args* (e.g. `titleKey: 'weakestSubject', titleArgs: [subjectName, pct]`). The store
and module stay language-agnostic; `InsightCard` resolves `$t.insights[key](...args)`
at render, so the feed re-renders on language toggle for free. Function-valued keys
follow the established interpolation style.

> **Type note:** `i18n` interpolation keys are functions with varying arities, so a
> single `keyof` union can't be called generically. The plan will resolve this with a
> small typed helper in `InsightCard` (e.g. a `resolve(key, args)` that narrows), or
> by having generators carry a pre-bound `(t) => string` thunk. The plan task picks
> one; both keep strings out of the store. **Decision deferred to the plan**, not left
> ambiguous: default is the `resolve` helper unless it proves un-typeable, then thunks.

### 3.2 `insights` derived store (in `src/lib/stores/data.ts`)

```ts
export const insights = derived(
  [subjects, topics, srsCards, sessions, scores, examSessions, readinessScore, streak, settings],
  ([...], ) => computeInsights({ ...snapshot, today: localDateStr(new Date()) }),
);
```

Re-exported from `data.ts` like the other derived stores. `settings` supplies
`dailyGoalHours` and `examDate`. `today` is computed in the derived body (the one
allowed `new Date()`), keeping `computeInsights` pure for tests.

### 3.3 `src/lib/components/insights/InsightCard.svelte` (new)

Presentational. Props `export let insight: Insight`. Renders icon, resolved title,
resolved body, and — if `insight.action` — an action link (`<a href>`), styled per
severity (high = warning accent, positive = primary-tinted, medium = neutral), using
only CSS tokens. No logic beyond resolving `$t` keys.

### 3.4 `src/routes/(app)/insights/+page.svelte` (rewrite)

Standard page: imports `onMount`, `auth`, `loadData`, `insights`, `t`; calls
`loadData($auth)` in `onMount` + `$: if ($auth.mode !== 'loading') loadData($auth)`.
Body: `{#if $insights.length === 0}` → empty state, `{:else}` → `{#each $insights as i (i.id)}<InsightCard insight={i} />`. A short page header (title + sub).

## 4. Insight catalog

Each generator returns `null` unless its **gate** is met. Thresholds are constants at
the top of `insights.ts` (tunable in one place).

| # | id | Family / severity | Gate | Card (English gloss) | Action |
|---|----|--------------------|------|----------------------|--------|
| 1 | `weakest-subject` | Focus / high | ≥2 subjects with a readiness score **and** ≥3 sessions logged total | "⚠ {Subject} needs attention — weakest area at {pct}% readiness" | → `/schedule` |
| 2 | `neglected-subject` | Focus / high | a subject that **has topics** and **no session in ≥7 days**, while the user has studied at all in the last 14d (else everything is neglected on a break) | "📉 {n} days since you studied {Subject}" | → `/timer` |
| 3 | `srs-backlog` | Focus / high | due-card count ≥ 10 | "🗂 {n} cards are due for review" | → `/review` |
| 4 | `readiness-gap` | Pace / high | `examDate` set **and** overall readiness < 60 | "🎯 Overall readiness is {pct}% — focus on weak areas" | → `/analytics` |
| 5 | `exam-countdown` | Pace / high if ≤14d else medium | `examDate` set and 0–60 days away | "⏰ {n} days to TCAS" | → `/schedule` |
| 6 | `score-trend` | Trends / medium | a subject with ≥2 mock scores; compares latest vs prior mean | up: "📈 Your {Subject} scores are improving (+{pct}%)" / down: "📉 Your {Subject} scores have dipped ({pct}%)" | → `/scores` |
| 7 | `time-balance` | Trends / medium | within the last 7d: one subject >50% of study time while another subject (with topics) got <10% | "⚖ Most of your week went to {A}; {B} is underserved" | → `/schedule` |
| 8 | `active-streak` | Momentum / positive | streak ≥ 2 | with today studied: "🔥 {n}-day streak — keep it going!"; without: "🔥 {n}-day streak — study today to keep it" | → `/timer` |
| 9 | `goal-adherence` | Momentum / positive | ≥1 study day in the last 7d | "✅ You hit your daily goal {n} of 7 days" (n = days in last 7 where summed hours ≥ `dailyGoalHours`) | — |

**One-per-generator rule:** each generator yields **at most one** insight — the single
most significant instance (the lowest-readiness subject for `weakest-subject`, the
longest-idle subject for `neglected-subject`, the subject with the largest absolute
trend for `score-trend`, etc.). This keeps the `Generator → Insight | null` signature
and prevents one rule from flooding the feed.

**De-dup rule:** at most **one** Focus card per subject (if a subject is both weakest
and neglected, keep the higher-severity/higher-priority one). Implemented in
`computeInsights` after generation, before the cap.

**Ranking:** severity band order `high → medium → positive`; within a band, ascending
`priority`. Cap = **7**. Generators that don't fire simply contribute nothing, so a
data-rich user sees the 7 most important and a new user may see 0–2.

## 5. Cold start / empty state

When `$insights` is empty (no generator fired — typical for a brand-new guest), render
the standard `.empty-state` block:

> **No insights yet**
> Study a few sessions and tips will show up here.
> [ Start studying → ] (link to `/timer`)

This is why every generator is gated: one session must not produce "Chemistry is your
weakest subject". Below-threshold insights stay hidden rather than misleading.

## 6. i18n

Expand the existing `insights` namespace in `en.ts` (canonical) + `th.ts` (mirror):

- Remove `comingSoon` (its only call site is the stub being rewritten); keep `title`.
- Add: page `sub`, empty-state `emptyTitle` / `emptySub` / `emptyAction`, and one
  title (and body where applicable) key per generator — function-valued where
  interpolated, e.g. `weakestSubject: (name: string, pct: number) => \`...\``,
  `daysSince: (n, name) => ...`, `streakKeep: (n) => ...`, `goalAdherence: (n) => ...`.
- Action labels (e.g. `actionSchedule`, `actionReview`, `actionStudy`, `actionScores`,
  `actionAnalytics`).
- All Thai drafted casual-friendly; reviewed at a checkpoint (same as WS3). The en/th
  parity guard test already enforces key+type parity.

## 7. Testing

`src/lib/insights.test.ts` (vitest):

- **Per generator:** a fixture snapshot where the gate is met → asserts the returned
  `Insight` (id, severity, args); a snapshot below the gate → asserts `null`.
- **`computeInsights`:** severity ordering, priority tiebreak, the 7-cap, and the
  per-subject Focus de-dup rule.
- Because generators take an injected `today` and a plain snapshot (no store/`Date.now()`
  access), tests are deterministic with no mocking.

i18n parity is covered by the existing `i18n.test.ts`.

## 8. File summary

**New**
- `src/lib/insights.ts` — types, `GENERATORS`, `computeInsights`.
- `src/lib/insights.test.ts` — unit tests.
- `src/lib/components/insights/InsightCard.svelte` — card view.

**Modified**
- `src/lib/stores/data.ts` — add + export the `insights` derived store.
- `src/routes/(app)/insights/+page.svelte` — rewrite stub → feed + empty state.
- `src/lib/i18n/en.ts` + `src/lib/i18n/th.ts` — expand `insights` namespace.

**Unchanged** — nav (Insights entry already exists in Sidebar/TabBar/MoreDrawer), schema, repos, auth.

## 9. Verification

- `npm run check` → 0 type errors.
- `npx vitest run` → all pass incl. new `insights.test.ts` + i18n parity.
- Browser: seed guest data covering several generators, confirm feed ranks/caps
  correctly and renders in both English and Thai; confirm the empty state on a fresh
  guest; confirm action links navigate.
