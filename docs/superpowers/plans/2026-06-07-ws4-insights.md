# WS4 Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/insights` "Coming soon" stub with a severity-ranked, gated feed of study-coach insight cards derived from existing stores.

**Architecture:** A pure `src/lib/insights.ts` (typed `Insight` + 9 gated generator functions + `computeInsights` for ranking/cap/de-dup) feeds a derived `insights` store in `data.ts`, rendered by `InsightCard.svelte` on a rewritten page. Generators take an injected snapshot (no store/`Date.now()` access) so they are pure and unit-testable. Everything derives from already-loaded stores, so guest and auth are identical with no schema change.

**Tech Stack:** SvelteKit 2 + Svelte 4 idiom, TypeScript, vitest. i18n via the dict-as-store `$t` (function-valued keys for interpolation), dates via `$fmt`.

**Spec:** `docs/superpowers/specs/2026-06-07-ws4-insights-design.md`
**Branch:** `feat/ws4-insights` (already created off merged master).

**Conventions for every task:**
- After code steps: `npm run check` must be 0 errors; `npx vitest run` must pass.
- No hardcoded hex — CSS tokens only. No `transition: width/height`.
- Card copy never baked into `insights.ts`/store — generators return i18n **key + args**; `InsightCard` resolves `$t` at render.
- Commit messages are given per task; end normal commits without Co-Authored trailer (repo convention from recent history).

---

## File structure

**New**
- `src/lib/insights.ts` — `Insight`/`InsightSeverity`/`InsightSnapshot` types, threshold constants, `GENERATORS`, `computeInsights`.
- `src/lib/insights.test.ts` — unit tests (per-generator + ranking/cap/de-dup).
- `src/lib/components/insights/InsightCard.svelte` — presentational card.

**Modified**
- `src/lib/i18n/en.ts` + `src/lib/i18n/th.ts` — expand `insights` namespace; drop `comingSoon` in the page-rewrite task.
- `src/lib/stores/data.ts` — add + export the `insights` derived store.
- `src/routes/(app)/insights/+page.svelte` — rewrite stub → feed + empty state.

---

## Task 1: Insight types + `computeInsights` (ranking, cap, de-dup)

**Files:**
- Create: `src/lib/insights.ts`
- Test: `src/lib/insights.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/insights.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeInsights, type Insight, type InsightSnapshot } from '$lib/insights';

// Minimal empty snapshot; individual generator tests override fields.
export const emptySnapshot: InsightSnapshot = {
  subjects: [], topics: [], srsCards: [], sessions: [], scores: [], examSessions: [],
  readiness: { overall: 0, bySubject: {} }, streak: 0, dailyGoalHours: 4,
  examDate: null, today: '2026-06-07',
};

// A tiny fake generator set is not exported; we test computeInsights via the real
// GENERATORS using crafted snapshots in later tasks. Here we test the pure helpers
// by importing the internal ranking through computeInsights with a hand-built list.
import { rankAndCap } from '$lib/insights';

const mk = (over: Partial<Insight>): Insight => ({
  id: 'x', severity: 'medium', priority: 0, icon: '•', titleKey: 'title', ...over,
});

describe('rankAndCap', () => {
  it('orders high → medium → positive, then by ascending priority', () => {
    const out = rankAndCap([
      mk({ id: 'pos', severity: 'positive', priority: 1 }),
      mk({ id: 'med', severity: 'medium', priority: 5 }),
      mk({ id: 'high', severity: 'high', priority: 9 }),
    ], 10);
    expect(out.map(i => i.id)).toEqual(['high', 'med', 'pos']);
  });

  it('caps the list length', () => {
    const list = Array.from({ length: 12 }, (_, n) => mk({ id: `i${n}`, priority: n }));
    expect(rankAndCap(list, 7)).toHaveLength(7);
  });

  it('keeps the best-ranked insight per subjectId, drops the rest', () => {
    const out = rankAndCap([
      mk({ id: 'neglected', severity: 'high', priority: 20, subjectId: 'phys' }),
      mk({ id: 'weakest', severity: 'high', priority: 10, subjectId: 'phys' }),
      mk({ id: 'other', severity: 'high', priority: 15, subjectId: 'chem' }),
    ], 10);
    expect(out.map(i => i.id)).toEqual(['weakest', 'other']);
  });
});

describe('computeInsights', () => {
  it('returns [] for an empty snapshot (all generators gated off)', () => {
    expect(computeInsights(emptySnapshot)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/insights.test.ts`
Expected: FAIL — `$lib/insights` has no exports yet.

- [ ] **Step 3: Write minimal implementation**

`src/lib/insights.ts`:

```ts
import type { I18n } from '$lib/i18n/en';
import type { Subject, Topic, SrsCard, StudySession, MockScore, ExamSession } from '$lib/types';

export type InsightSeverity = 'high' | 'medium' | 'positive';
export type InsightKey = keyof I18n['insights'];

export interface InsightAction {
  labelKey: InsightKey;
  href: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  priority: number;            // ascending tiebreak within a severity band
  icon: string;
  titleKey: InsightKey;
  titleArgs?: (string | number)[];
  bodyKey?: InsightKey;
  bodyArgs?: (string | number)[];
  action?: InsightAction;
  subjectId?: string;          // present → participates in per-subject de-dup
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
  examDate: string | null;     // YYYY-MM-DD | null
  today: string;               // YYYY-MM-DD, injected by the store
}

export type Generator = (s: InsightSnapshot) => Insight | null;

// ── thresholds (tune in one place) ──────────────────────────────
export const CAP = 7;
const SEV_RANK: Record<InsightSeverity, number> = { high: 0, medium: 1, positive: 2 };

const rank = (i: Insight) => SEV_RANK[i.severity] * 1000 + i.priority;

/** Pure ranking core: per-subject de-dup (keep best rank), sort by band then priority, cap. */
export function rankAndCap(list: Insight[], cap = CAP): Insight[] {
  const bySubject = new Map<string, Insight>();
  const noSubject: Insight[] = [];
  for (const i of list) {
    if (i.subjectId) {
      const prev = bySubject.get(i.subjectId);
      if (!prev || rank(i) < rank(prev)) bySubject.set(i.subjectId, i);
    } else {
      noSubject.push(i);
    }
  }
  return [...noSubject, ...bySubject.values()].sort((a, b) => rank(a) - rank(b)).slice(0, cap);
}

// Generators are appended in Tasks 3–6.
export const GENERATORS: Generator[] = [];

export function computeInsights(s: InsightSnapshot, cap = CAP): Insight[] {
  const raw = GENERATORS.map((g) => g(s)).filter((i): i is Insight => i !== null);
  return rankAndCap(raw, cap);
}

// ── shared helpers for generators ───────────────────────────────
/** Whole-day difference between two YYYY-MM-DD strings (to − from). */
export function dayDiff(fromDateStr: string, toDateStr: string): number {
  return Math.round(
    (new Date(toDateStr + 'T00:00:00').getTime() - new Date(fromDateStr + 'T00:00:00').getTime()) / 86400000,
  );
}
```

> Note: `titleKey: 'title'` in the test references the existing `insights.title` key, valid today. Generator tasks use the new keys added in Task 2.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/insights.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/insights.ts src/lib/insights.test.ts
git commit -m "feat(insights): Insight types + computeInsights ranking core"
```

---

## Task 2: Expand the `insights` i18n namespace

**Files:**
- Modify: `src/lib/i18n/en.ts` (insights namespace)
- Modify: `src/lib/i18n/th.ts` (insights namespace)

Keep `comingSoon` for now (the stub still uses it; removed in Task 9).

- [ ] **Step 1: Add keys to `en.ts`** — replace the existing `insights: { title, comingSoon }` block with:

```ts
  insights: {
    title: 'Insights',
    comingSoon: 'Coming soon',
    sub: 'What to focus on next',
    emptyTitle: 'No insights yet',
    emptySub: 'Study a few sessions and tips will show up here.',
    emptyAction: 'Start studying',
    weakestTitle: (name: string) => `${name} needs attention`,
    weakestBody: (pct: number) => `Weakest area at ${pct}% readiness`,
    neglectedTitle: (name: string) => `Time to revisit ${name}`,
    neglectedBody: (n: number) => `${n} days since your last session`,
    backlogTitle: (n: number) => `${n} cards due for review`,
    backlogBody: 'Clear them now to protect your retention.',
    readinessGapTitle: (pct: number) => `Overall readiness is ${pct}%`,
    readinessGapBody: 'Put your time into the weakest subjects.',
    countdownTitle: (n: number) => `${n} days to TCAS`,
    countdownBody: 'Keep your weak areas moving.',
    trendUpTitle: (name: string) => `${name} is trending up`,
    trendUpBody: (pct: number) => `Mock scores up ${pct}% recently`,
    trendDownTitle: (name: string) => `${name} scores have dipped`,
    trendDownBody: (pct: number) => `Down ${pct}% from your average`,
    balanceTitle: 'Uneven study balance',
    balanceBody: (a: string, b: string) => `Most of your week went to ${a}; ${b} is underserved`,
    streakTitle: (n: number) => `${n}-day streak`,
    streakKeepBody: 'Keep it going!',
    streakTodayBody: 'Study today to keep it alive.',
    goalTitle: (n: number) => `Daily goal hit ${n} of 7 days`,
    goalBody: 'Nice consistency.',
    actionSchedule: 'Schedule it',
    actionStudy: 'Start a session',
    actionReview: 'Review now',
    actionScores: 'View scores',
    actionAnalytics: 'See analytics',
  },
```

- [ ] **Step 2: Mirror in `th.ts`** — replace the existing `insights` block with:

```ts
  insights: {
    title: 'อินไซต์',
    comingSoon: 'เร็วๆ นี้',
    sub: 'สิ่งที่ควรโฟกัสต่อไป',
    emptyTitle: 'ยังไม่มีอินไซต์',
    emptySub: 'เรียนสักสองสามครั้งแล้วคำแนะนำจะปรากฏที่นี่',
    emptyAction: 'เริ่มเรียน',
    weakestTitle: (name: string) => `${name} ต้องให้ความสนใจ`,
    weakestBody: (pct: number) => `จุดอ่อนที่สุด ความพร้อม ${pct}%`,
    neglectedTitle: (name: string) => `กลับไปทบทวน ${name} กันเถอะ`,
    neglectedBody: (n: number) => `${n} วันแล้วตั้งแต่เรียนครั้งล่าสุด`,
    backlogTitle: (n: number) => `มีการ์ด ${n} ใบรอทบทวน`,
    backlogBody: 'เคลียร์เลยตอนนี้เพื่อรักษาความจำ',
    readinessGapTitle: (pct: number) => `ความพร้อมรวม ${pct}%`,
    readinessGapBody: 'ทุ่มเวลาให้วิชาที่อ่อนที่สุด',
    countdownTitle: (n: number) => `อีก ${n} วันสอบ TCAS`,
    countdownBody: 'ดันวิชาที่อ่อนต่อไปเรื่อยๆ',
    trendUpTitle: (name: string) => `${name} กำลังดีขึ้น`,
    trendUpBody: (pct: number) => `คะแนนสอบขึ้น ${pct}% เมื่อเร็วๆ นี้`,
    trendDownTitle: (name: string) => `คะแนน ${name} ลดลง`,
    trendDownBody: (pct: number) => `ต่ำกว่าค่าเฉลี่ย ${pct}%`,
    balanceTitle: 'เวลาเรียนไม่สมดุล',
    balanceBody: (a: string, b: string) => `สัปดาห์นี้ส่วนใหญ่ทุ่มให้ ${a} ส่วน ${b} ยังน้อยไป`,
    streakTitle: (n: number) => `สตรีค ${n} วัน`,
    streakKeepBody: 'ทำต่อไป!',
    streakTodayBody: 'เรียนวันนี้เพื่อรักษาสตรีคไว้',
    goalTitle: (n: number) => `ทำเป้าหมายรายวันได้ ${n} จาก 7 วัน`,
    goalBody: 'สม่ำเสมอดีมาก',
    actionSchedule: 'จัดตาราง',
    actionStudy: 'เริ่มเซสชัน',
    actionReview: 'ทบทวนเลย',
    actionScores: 'ดูคะแนน',
    actionAnalytics: 'ดูสถิติ',
  },
```

- [ ] **Step 3: Verify parity + types**

Run: `npx vitest run src/lib/i18n` → 5 pass (en/th key+type parity).
Run: `npm run check` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat(i18n): expand insights namespace for the feed"
```

---

## Task 3: Focus generators (weakest / neglected / backlog)

**Files:**
- Modify: `src/lib/insights.ts` (add 3 generators + register in `GENERATORS`)
- Test: `src/lib/insights.test.ts` (add cases)

- [ ] **Step 1: Write failing tests** — append to `insights.test.ts`:

```ts
import { computeInsights as ci } from '$lib/insights';

const subj = (id: string, name: string): import('$lib/types').Subject =>
  ({ id, userId: 'u', name, symbol: name[0], color: '#000', colorRgb: '0,0,0', orderIndex: 0 });
const sess = (subjectId: string, startedAt: string): import('$lib/types').StudySession =>
  ({ id: startedAt + subjectId, userId: 'u', subjectId, startedAt, endedAt: startedAt, durationSec: 1800, mode: 'free' });

describe('focus generators', () => {
  it('weakest-subject fires for the lowest-readiness subject with enough data', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('p', 'Physics'), subj('c', 'Chemistry')],
      sessions: [sess('p', '2026-06-05T08:00:00'), sess('p', '2026-06-06T08:00:00'), sess('c', '2026-06-06T09:00:00')],
      readiness: { overall: 50, bySubject: { p: 70, c: 30 } },
    });
    const weak = out.find(i => i.id === 'weakest-subject');
    expect(weak).toBeTruthy();
    expect(weak!.titleArgs).toEqual(['Chemistry']);
    expect(weak!.bodyArgs).toEqual([30]);
  });

  it('weakest-subject is null with fewer than 3 sessions', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('p', 'Physics'), subj('c', 'Chemistry')],
      sessions: [sess('p', '2026-06-06T08:00:00')],
      readiness: { overall: 50, bySubject: { p: 70, c: 30 } },
    });
    expect(out.find(i => i.id === 'weakest-subject')).toBeUndefined();
  });

  it('srs-backlog fires when ≥10 cards are due', () => {
    const cards = Array.from({ length: 11 }, (_, n) => ({
      id: 'c' + n, topicId: 't', userId: 'u', ease: 2.5, intervalDays: 1, dueDate: '2026-06-01', reps: 1,
    }));
    const out = ci({ ...emptySnapshot, srsCards: cards });
    const b = out.find(i => i.id === 'srs-backlog');
    expect(b?.titleArgs).toEqual([11]);
  });

  it('neglected-subject fires for a topic-bearing subject idle ≥7 days (given recent activity)', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('p', 'Physics'), subj('c', 'Chemistry')],
      topics: [{ id: 't1', subjectId: 'p', name: 'Kinematics', orderIndex: 0 }],
      sessions: [sess('p', '2026-05-28T08:00:00'), sess('c', '2026-06-06T08:00:00')], // Physics 10d ago, recent activity exists
      readiness: { overall: 50, bySubject: { p: 60, c: 60 } },
    });
    const n = out.find(i => i.id === 'neglected-subject');
    expect(n?.titleArgs).toEqual(['Physics']);
    expect(n?.bodyArgs).toEqual([10]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/insights.test.ts`
Expected: FAIL (generators not registered).

- [ ] **Step 3: Implement** — in `insights.ts`, add constants near the others and the generators above the `GENERATORS` array, then register them:

```ts
const MIN_SESSIONS = 3;
const NEGLECT_DAYS = 7;
const RECENT_ACTIVITY_DAYS = 14;
const SRS_BACKLOG_MIN = 10;

const weakestSubject: Generator = (s) => {
  if (s.subjects.length < 2 || s.sessions.length < MIN_SESSIONS) return null;
  const scored = s.subjects.filter((sub) => sub.id in s.readiness.bySubject);
  if (scored.length < 2) return null;
  let worst = scored[0];
  for (const sub of scored) {
    if (s.readiness.bySubject[sub.id] < s.readiness.bySubject[worst.id]) worst = sub;
  }
  return {
    id: 'weakest-subject', severity: 'high', priority: 10, icon: '⚠️', subjectId: worst.id,
    titleKey: 'weakestTitle', titleArgs: [worst.name],
    bodyKey: 'weakestBody', bodyArgs: [s.readiness.bySubject[worst.id]],
    action: { labelKey: 'actionSchedule', href: '/schedule' },
  };
};

const neglectedSubject: Generator = (s) => {
  const studiedRecently = s.sessions.some((se) => dayDiff(se.startedAt.slice(0, 10), s.today) <= RECENT_ACTIVITY_DAYS);
  if (!studiedRecently) return null;
  const withTopics = new Set(s.topics.map((t) => t.subjectId));
  let best: { sub: Subject; days: number } | null = null;
  for (const sub of s.subjects) {
    if (!withTopics.has(sub.id)) continue;
    const days = s.sessions
      .filter((se) => se.subjectId === sub.id)
      .map((se) => dayDiff(se.startedAt.slice(0, 10), s.today));
    if (days.length === 0) continue;               // never studied → covered by weakest/readiness
    const gap = Math.min(...days);
    if (gap >= NEGLECT_DAYS && (!best || gap > best.days)) best = { sub, days: gap };
  }
  if (!best) return null;
  return {
    id: 'neglected-subject', severity: 'high', priority: 15, icon: '📉', subjectId: best.sub.id,
    titleKey: 'neglectedTitle', titleArgs: [best.sub.name],
    bodyKey: 'neglectedBody', bodyArgs: [best.days],
    action: { labelKey: 'actionStudy', href: '/timer' },
  };
};

const srsBacklog: Generator = (s) => {
  const due = s.srsCards.filter((c) => c.dueDate <= s.today).length;
  if (due < SRS_BACKLOG_MIN) return null;
  return {
    id: 'srs-backlog', severity: 'high', priority: 20, icon: '🗂️',
    titleKey: 'backlogTitle', titleArgs: [due], bodyKey: 'backlogBody',
    action: { labelKey: 'actionReview', href: '/review' },
  };
};
```

Then set:

```ts
export const GENERATORS: Generator[] = [weakestSubject, neglectedSubject, srsBacklog];
```

- [ ] **Step 4: Run tests + check**

Run: `npx vitest run src/lib/insights.test.ts` → PASS.
Run: `npm run check` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights.ts src/lib/insights.test.ts
git commit -m "feat(insights): focus generators (weakest/neglected/backlog)"
```

---

## Task 4: Pace generators (readiness-gap / exam-countdown)

**Files:**
- Modify: `src/lib/insights.ts`
- Test: `src/lib/insights.test.ts`

- [ ] **Step 1: Failing tests** — append:

```ts
describe('pace generators', () => {
  const threeSessions = [
    sess('p', '2026-06-04T08:00:00'), sess('p', '2026-06-05T08:00:00'), sess('p', '2026-06-06T08:00:00'),
  ];
  it('readiness-gap fires when exam set and overall < 60 (with study history)', () => {
    const out = ci({
      ...emptySnapshot, subjects: [subj('p', 'Physics')], sessions: threeSessions,
      examDate: '2026-07-01', readiness: { overall: 45, bySubject: { p: 45 } },
    });
    expect(out.find(i => i.id === 'readiness-gap')?.titleArgs).toEqual([45]);
  });
  it('readiness-gap is null without an exam date', () => {
    const out = ci({
      ...emptySnapshot, subjects: [subj('p', 'Physics')], sessions: threeSessions,
      examDate: null, readiness: { overall: 45, bySubject: { p: 45 } },
    });
    expect(out.find(i => i.id === 'readiness-gap')).toBeUndefined();
  });
  it('exam-countdown fires within 60 days and is high severity inside 14', () => {
    const out = ci({ ...emptySnapshot, examDate: '2026-06-15' }); // 8 days from 06-07
    const c = out.find(i => i.id === 'exam-countdown');
    expect(c?.titleArgs).toEqual([8]);
    expect(c?.severity).toBe('high');
  });
  it('exam-countdown is null when the exam is >60 days away', () => {
    const out = ci({ ...emptySnapshot, examDate: '2026-12-31' });
    expect(out.find(i => i.id === 'exam-countdown')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/insights.test.ts` → FAIL.

- [ ] **Step 3: Implement** — add constants + generators, then extend `GENERATORS`:

```ts
const READINESS_GAP_MAX = 60;
const EXAM_SOON_DAYS = 60;
const EXAM_URGENT_DAYS = 14;

const readinessGap: Generator = (s) => {
  if (!s.examDate || s.subjects.length === 0 || s.sessions.length < MIN_SESSIONS) return null;
  if (s.readiness.overall >= READINESS_GAP_MAX) return null;
  return {
    id: 'readiness-gap', severity: 'high', priority: 5, icon: '🎯',
    titleKey: 'readinessGapTitle', titleArgs: [s.readiness.overall], bodyKey: 'readinessGapBody',
    action: { labelKey: 'actionAnalytics', href: '/analytics' },
  };
};

const examCountdown: Generator = (s) => {
  if (!s.examDate) return null;
  const days = dayDiff(s.today, s.examDate);
  if (days < 0 || days > EXAM_SOON_DAYS) return null;
  return {
    id: 'exam-countdown', severity: days <= EXAM_URGENT_DAYS ? 'high' : 'medium', priority: 8, icon: '⏰',
    titleKey: 'countdownTitle', titleArgs: [days], bodyKey: 'countdownBody',
    action: { labelKey: 'actionSchedule', href: '/schedule' },
  };
};
```

```ts
export const GENERATORS: Generator[] = [
  weakestSubject, neglectedSubject, srsBacklog, readinessGap, examCountdown,
];
```

- [ ] **Step 4: Run tests + check** → PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights.ts src/lib/insights.test.ts
git commit -m "feat(insights): pace generators (readiness-gap/countdown)"
```

---

## Task 5: Trends generators (score-trend / time-balance)

**Files:**
- Modify: `src/lib/insights.ts`
- Test: `src/lib/insights.test.ts`

- [ ] **Step 1: Failing tests** — append:

```ts
const score = (subjectId: string, takenAt: string, raw: number): import('$lib/types').MockScore =>
  ({ id: takenAt + subjectId + raw, userId: 'u', subjectId, score: raw, maxScore: 100, takenAt, createdAt: takenAt });

describe('trends generators', () => {
  it('score-trend reports the subject with the largest absolute change (up)', () => {
    const out = ci({
      ...emptySnapshot, subjects: [subj('b', 'Biology')],
      scores: [score('b', '2026-05-01', 50), score('b', '2026-05-10', 50), score('b', '2026-06-01', 70)],
    });
    const t = out.find(i => i.id === 'score-trend');
    expect(t?.titleKey).toBe('trendUpTitle');
    expect(t?.titleArgs).toEqual(['Biology']);
    expect(t?.bodyArgs).toEqual([20]); // 70 − mean(50,50)=50 → +20
  });

  it('score-trend is null with fewer than 2 scores', () => {
    const out = ci({ ...emptySnapshot, subjects: [subj('b', 'Biology')], scores: [score('b', '2026-06-01', 70)] });
    expect(out.find(i => i.id === 'score-trend')).toBeUndefined();
  });

  it('time-balance flags a hogging subject vs an underserved topic-bearing one', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('m', 'Math'), subj('e', 'English')],
      topics: [{ id: 't', subjectId: 'e', name: 'Grammar', orderIndex: 0 }],
      sessions: [
        sess('m', '2026-06-06T08:00:00'), sess('m', '2026-06-06T09:00:00'),
        sess('m', '2026-06-05T08:00:00'), // Math dominates last 7 days, English 0
      ],
    });
    const b = out.find(i => i.id === 'time-balance');
    expect(b?.bodyArgs).toEqual(['Math', 'English']);
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement** — add constants + generators, extend `GENERATORS`:

```ts
const TIME_WINDOW_DAYS = 7;
const TIME_HOG_PCT = 0.5;
const TIME_UNDERSERVED_PCT = 0.1;

const scoreTrend: Generator = (s) => {
  const pct = (sc: MockScore) => (sc.maxScore > 0 ? (sc.score / sc.maxScore) * 100 : 0);
  let best: { name: string; delta: number } | null = null;
  for (const sub of s.subjects) {
    const subScores = s.scores
      .filter((sc) => sc.subjectId === sub.id)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    if (subScores.length < 2) continue;
    const latest = pct(subScores[subScores.length - 1]);
    const prior = subScores.slice(0, -1);
    const priorMean = prior.reduce((a, c) => a + pct(c), 0) / prior.length;
    const delta = Math.round(latest - priorMean);
    if (delta === 0) continue;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { name: sub.name, delta };
  }
  if (!best) return null;
  const up = best.delta > 0;
  return {
    id: 'score-trend', severity: 'medium', priority: 30, icon: up ? '📈' : '📉',
    titleKey: up ? 'trendUpTitle' : 'trendDownTitle', titleArgs: [best.name],
    bodyKey: up ? 'trendUpBody' : 'trendDownBody', bodyArgs: [Math.abs(best.delta)],
    action: { labelKey: 'actionScores', href: '/scores' },
  };
};

const timeBalance: Generator = (s) => {
  const withTopics = new Set(s.topics.map((t) => t.subjectId));
  const secsBy: Record<string, number> = {};
  let total = 0;
  for (const se of s.sessions) {
    if (dayDiff(se.startedAt.slice(0, 10), s.today) > TIME_WINDOW_DAYS) continue;
    secsBy[se.subjectId] = (secsBy[se.subjectId] ?? 0) + se.durationSec;
    total += se.durationSec;
  }
  if (total === 0) return null;
  const hogId = Object.keys(secsBy).find((id) => secsBy[id] / total > TIME_HOG_PCT);
  if (!hogId) return null;
  const hog = s.subjects.find((sub) => sub.id === hogId);
  if (!hog) return null;
  const under = s.subjects.find(
    (sub) => sub.id !== hogId && withTopics.has(sub.id) && (secsBy[sub.id] ?? 0) / total < TIME_UNDERSERVED_PCT,
  );
  if (!under) return null;
  return {
    id: 'time-balance', severity: 'medium', priority: 35, icon: '⚖️',
    titleKey: 'balanceTitle', bodyKey: 'balanceBody', bodyArgs: [hog.name, under.name],
    action: { labelKey: 'actionSchedule', href: '/schedule' },
  };
};
```

```ts
export const GENERATORS: Generator[] = [
  weakestSubject, neglectedSubject, srsBacklog, readinessGap, examCountdown, scoreTrend, timeBalance,
];
```

- [ ] **Step 4: Run tests + check** → PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights.ts src/lib/insights.test.ts
git commit -m "feat(insights): trends generators (score-trend/time-balance)"
```

---

## Task 6: Momentum generators (active-streak / goal-adherence)

**Files:**
- Modify: `src/lib/insights.ts`
- Test: `src/lib/insights.test.ts`

- [ ] **Step 1: Failing tests** — append:

```ts
describe('momentum generators', () => {
  it('active-streak nudges to study when today has no session', () => {
    const out = ci({
      ...emptySnapshot, streak: 5,
      sessions: [sess('p', '2026-06-06T08:00:00')], // yesterday, not today (today=06-07)
    });
    const st = out.find(i => i.id === 'active-streak');
    expect(st?.titleArgs).toEqual([5]);
    expect(st?.bodyKey).toBe('streakTodayBody');
    expect(st?.action?.href).toBe('/timer');
  });

  it('active-streak has no action once today is studied', () => {
    const out = ci({
      ...emptySnapshot, streak: 5, sessions: [sess('p', '2026-06-07T08:00:00')],
    });
    const st = out.find(i => i.id === 'active-streak');
    expect(st?.bodyKey).toBe('streakKeepBody');
    expect(st?.action).toBeUndefined();
  });

  it('goal-adherence counts days hitting the daily goal in the last 7', () => {
    // two sessions same day summing 2h with goal 1.5h → 1 day hit
    const out = ci({
      ...emptySnapshot, dailyGoalHours: 1.5,
      sessions: [
        { ...sess('p', '2026-06-06T08:00:00'), durationSec: 3600 },
        { ...sess('p', '2026-06-06T10:00:00'), durationSec: 3600 },
      ],
    });
    expect(out.find(i => i.id === 'goal-adherence')?.titleArgs).toEqual([1]);
  });

  it('goal-adherence is null when no day reached the goal', () => {
    const out = ci({
      ...emptySnapshot, dailyGoalHours: 4,
      sessions: [{ ...sess('p', '2026-06-06T08:00:00'), durationSec: 1800 }],
    });
    expect(out.find(i => i.id === 'goal-adherence')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement** — add constant + generators, extend `GENERATORS`:

```ts
const STREAK_MIN = 2;
const GOAL_WINDOW_DAYS = 6; // last 7 days inclusive of today

const activeStreak: Generator = (s) => {
  if (s.streak < STREAK_MIN) return null;
  const studiedToday = s.sessions.some((se) => se.startedAt.slice(0, 10) === s.today);
  return {
    id: 'active-streak', severity: 'positive', priority: 50, icon: '🔥',
    titleKey: 'streakTitle', titleArgs: [s.streak],
    bodyKey: studiedToday ? 'streakKeepBody' : 'streakTodayBody',
    action: studiedToday ? undefined : { labelKey: 'actionStudy', href: '/timer' },
  };
};

const goalAdherence: Generator = (s) => {
  const byDay: Record<string, number> = {};
  for (const se of s.sessions) {
    const d = se.startedAt.slice(0, 10);
    const diff = dayDiff(d, s.today);
    if (diff < 0 || diff > GOAL_WINDOW_DAYS) continue;
    byDay[d] = (byDay[d] ?? 0) + se.durationSec / 3600;
  }
  if (Object.keys(byDay).length === 0) return null;
  const hitDays = Object.values(byDay).filter((h) => h >= s.dailyGoalHours).length;
  if (hitDays < 1) return null;
  return {
    id: 'goal-adherence', severity: 'positive', priority: 55, icon: '✅',
    titleKey: 'goalTitle', titleArgs: [hitDays], bodyKey: 'goalBody',
  };
};
```

```ts
export const GENERATORS: Generator[] = [
  weakestSubject, neglectedSubject, srsBacklog, readinessGap, examCountdown,
  scoreTrend, timeBalance, activeStreak, goalAdherence,
];
```

- [ ] **Step 4: Run tests + check** → PASS (all generator + ranking tests), 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights.ts src/lib/insights.test.ts
git commit -m "feat(insights): momentum generators (streak/goal-adherence)"
```

---

## Task 7: `insights` derived store

**Files:**
- Modify: `src/lib/stores/data.ts`

- [ ] **Step 1: Add the store** — at the top of `data.ts`, add imports:

```ts
import { computeInsights } from '$lib/insights';
import { localDateStr } from '$lib/utils';
import { settings } from '$lib/stores/settings';
```

Then add, after the `readinessScore` derived block:

```ts
export const insights = derived(
  [subjects, topics, srsCards, sessions, scores, examSessions, readinessScore, streak, settings],
  ([$subjects, $topics, $srsCards, $sessions, $scores, $examSessions, $readiness, $streak, $settings]) =>
    computeInsights({
      subjects: $subjects,
      topics: $topics,
      srsCards: $srsCards,
      sessions: $sessions,
      scores: $scores,
      examSessions: $examSessions,
      readiness: $readiness,
      streak: $streak,
      dailyGoalHours: $settings.dailyGoalHours,
      examDate: $settings.examDate,
      today: localDateStr(new Date()),
    }),
);
```

> `settings` exposes `dailyGoalHours` and `examDate` (see `src/lib/stores/settings.ts` `Settings` interface). `readinessScore` and `streak` are already defined above in this file.

- [ ] **Step 2: Type-check + full tests**

Run: `npm run check` → 0 errors.
Run: `npx vitest run` → all pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/data.ts
git commit -m "feat(insights): derived insights store wired to existing stores"
```

---

## Task 8: `InsightCard.svelte`

**Files:**
- Create: `src/lib/components/insights/InsightCard.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Insight } from '$lib/insights';

  export let insight: Insight;

  // i18n values are either plain strings or interpolation functions of varying arity.
  const resolve = (v: unknown, args: (string | number)[] = []): string =>
    typeof v === 'function' ? (v as (...a: unknown[]) => string)(...args) : (v as string);

  $: title = resolve($t.insights[insight.titleKey], insight.titleArgs);
  $: body = insight.bodyKey ? resolve($t.insights[insight.bodyKey], insight.bodyArgs) : '';
  $: actionLabel = insight.action ? resolve($t.insights[insight.action.labelKey]) : '';
</script>

<div class="insight-card sev-{insight.severity}">
  <span class="insight-icon" aria-hidden="true">{insight.icon}</span>
  <div class="insight-body">
    <p class="insight-title">{title}</p>
    {#if body}<p class="insight-sub">{body}</p>{/if}
    {#if insight.action}
      <a class="insight-action" href={insight.action.href}>{actionLabel} →</a>
    {/if}
  </div>
</div>

<style>
  .insight-card {
    display: flex; gap: 12px; align-items: flex-start;
    background: var(--bg2); border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: var(--radius-md); padding: 14px 16px;
  }
  .sev-high { border-left-color: var(--danger); }
  .sev-medium { border-left-color: var(--primary); }
  .sev-positive { border-left-color: var(--success); }
  .insight-icon { font-size: 18px; line-height: 1.4; flex-shrink: 0; }
  .insight-body { flex: 1; min-width: 0; }
  .insight-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; }
  .insight-sub { font-size: 13px; color: var(--muted); margin: 2px 0 0; line-height: 1.4; }
  .insight-action {
    display: inline-block; margin-top: 8px;
    font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none;
  }
  .insight-action:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check` → 0 errors.

> If `--success` / `--danger` are missing in any of the five theme blocks, add them (check all five in `app.css`). `--danger` is already used by `ConfirmDialog`/score error states; `--success` is used by the toast. Both exist — verify with: `npx rg "--success|--danger" src/app.css | head`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/insights/InsightCard.svelte
git commit -m "feat(insights): InsightCard component"
```

---

## Task 9: Rewrite the `/insights` page + drop `comingSoon`

**Files:**
- Modify: `src/routes/(app)/insights/+page.svelte` (full rewrite)
- Modify: `src/lib/i18n/en.ts` + `src/lib/i18n/th.ts` (remove now-orphaned `comingSoon`)

- [ ] **Step 1: Rewrite the page**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { insights, loadData } from '$lib/stores/data';
  import { t } from '$lib/i18n';
  import InsightCard from '$lib/components/insights/InsightCard.svelte';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

<div class="insights-page">
  <header class="page-head">
    <h1 class="page-title">{$t.insights.title}</h1>
    <p class="page-sub">{$t.insights.sub}</p>
  </header>

  {#if $insights.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.insights.emptyTitle}</p>
      <p class="empty-sub">{$t.insights.emptySub}</p>
      <a class="empty-action" href="/timer">{$t.insights.emptyAction} →</a>
    </div>
  {:else}
    <div class="feed">
      {#each $insights as insight (insight.id)}
        <InsightCard {insight} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .insights-page { padding: 20px 16px 80px; max-width: 720px; margin: 0 auto; }
  .page-head { margin-bottom: 20px; }
  .page-title { font-size: 22px; font-weight: 700; margin: 0; color: var(--text); }
  .page-sub { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
  .feed { display: flex; flex-direction: column; gap: 10px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
  .empty-action { display: inline-block; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none; }
  .empty-action:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 2: Remove the orphaned `comingSoon` key** from both files (the only call site is now gone).

In `src/lib/i18n/en.ts`, delete the line `comingSoon: 'Coming soon',` from the `insights` block.
In `src/lib/i18n/th.ts`, delete the line `comingSoon: 'เร็วๆ นี้',` from the `insights` block.

- [ ] **Step 3: Verify nothing else references `comingSoon`**

Run: `npx rg "comingSoon" src` → expected: no matches.

- [ ] **Step 4: Type-check + tests**

Run: `npm run check` → 0 errors.
Run: `npx vitest run` → all pass (i18n parity still green — both files dropped the key together).

- [ ] **Step 5: Commit**

```bash
git add src/routes/'(app)'/insights/+page.svelte src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat(insights): feed page + empty state; drop comingSoon stub key"
```

---

## Task 10: Browser verification, Thai review, finish

**Files:**
- Modify: `docs/CHANGELOG.md`, `CLAUDE.md` (Active Plans)

- [ ] **Step 1: Seed + verify in the browser (guest, English)**

Start dev server (`npm run dev`). In the browser console, seed guest data that triggers several generators (subjects with differing readiness via sessions/scores, a >7-day-old subject, ≥10 due cards, a near exam date), reload `/insights`. Confirm:
- cards are severity-ordered (high → medium → positive), capped at 7;
- only one card per subject in the Focus group;
- action links navigate to the right routes;
- the empty state shows for a fresh guest (clear `localStorage`).

- [ ] **Step 2: Verify Thai rendering**

Set `pulse_settings.lang = 'th'` in localStorage, reload `/insights`, confirm every card title/body/action renders Thai and re-renders on toggle (no English leakage). Check dates/numbers read naturally.

- [ ] **Step 3: Thai copy review checkpoint**

Present `git diff master -- src/lib/i18n/th.ts` (the new `insights` Thai strings) to the user for casual-voice review; apply corrections; if any, commit `i18n(th): refine insights copy`.

- [ ] **Step 4: Update docs**

Add a CHANGELOG entry at the top of `docs/CHANGELOG.md`:

```
- `docs/superpowers/plans/2026-06-07-ws4-insights.md` — WS4 Insights: replaced the `/insights` stub with a study-coach feed — a severity-ranked, gated set of insight cards (9 pure generators: weakest/neglected/backlog, readiness-gap/exam-countdown, score-trend/time-balance, streak/goal-adherence) computed by `computeInsights` (rank → per-subject de-dup → cap 7) over existing stores via a derived `insights` store. Generators return i18n key+args; `InsightCard` resolves `$t` at render (re-renders on language toggle); guest/auth identical, no schema. Friendly gated empty state. Full unit tests per generator + ranking; en/th parity. 0 type errors.
```

Remove the WS4 Insights item from `CLAUDE.md` → Active Plans → Planned (the `WS4 features` line stays for the exam-already-shipped note only if still relevant; otherwise tighten it), and bump the changelog count in the Completed pointer.

- [ ] **Step 5: Final verify + commit**

Run: `npm run check` → 0 errors. Run: `npx vitest run` → all pass.

```bash
git add docs/CHANGELOG.md CLAUDE.md
git commit -m "docs(ws4): log Insights in CHANGELOG + clear from Active Plans"
```

- [ ] **Step 6: Finish the branch**

Use `superpowers:finishing-a-development-branch`: push `feat/ws4-insights`, open a PR. **Merging to `master` is a production action — get explicit user go-ahead**, then merge and run the `git -C` fast-forward sync ritual.

---

## Self-review notes

- **Spec coverage:** architecture (Tasks 1,7,8,9), all 9 generators with gates (Tasks 3–6), ranking/cap/de-dup (Task 1), i18n key-based copy (Tasks 2,8,9), empty state (Task 9), per-generator tests (Tasks 3–6), browser + Thai review + finish (Task 10). All spec sections map to a task.
- **Type consistency:** `Insight`/`InsightSnapshot`/`Generator`/`computeInsights`/`rankAndCap`/`dayDiff` names are stable across tasks; generator ids match their `id` fields and the de-dup/test expectations; i18n keys used by generators (`weakestTitle`, `neglectedBody`, `countdownTitle`, `trendUpBody`, `balanceBody`, `streakTodayBody`, `goalTitle`, `action*`) are all defined in Task 2.
- **i18n resolution decision:** locked to the `resolve` helper in `InsightCard` (handles string|function values); no thunks in generators. (Spec §3.1 deferral resolved.)
