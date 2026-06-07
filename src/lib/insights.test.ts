import { describe, it, expect } from 'vitest';
import { computeInsights, computeInsights as ci, rankAndCap, type Insight, type InsightSnapshot } from '$lib/insights';
import type { Subject, StudySession, MockScore } from '$lib/types';

const emptySnapshot: InsightSnapshot = {
  subjects: [], topics: [], srsCards: [], sessions: [], scores: [], examSessions: [],
  readiness: { overall: 0, bySubject: {} }, streak: 0, dailyGoalHours: 4,
  examDate: null, today: '2026-06-07',
};

const mk = (over: Partial<Insight>): Insight => ({
  id: 'x', severity: 'medium', priority: 0, icon: '•', titleKey: 'title', ...over,
});

const subj = (id: string, name: string): Subject =>
  ({ id, userId: 'u', name, symbol: name[0], color: '#000', colorRgb: '0,0,0', orderIndex: 0 });
const sess = (subjectId: string, startedAt: string): StudySession =>
  ({ id: startedAt + subjectId, userId: 'u', subjectId, startedAt, endedAt: startedAt, durationSec: 1800, mode: 'free' });
const score = (subjectId: string, takenAt: string, raw: number): MockScore =>
  ({ id: takenAt + subjectId + raw, userId: 'u', subjectId, score: raw, maxScore: 100, takenAt, createdAt: takenAt });

describe('rankAndCap', () => {
  it('orders high → medium → positive, then by ascending priority', () => {
    const out = rankAndCap([
      mk({ id: 'pos', severity: 'positive', priority: 1 }),
      mk({ id: 'med', severity: 'medium', priority: 5 }),
      mk({ id: 'high', severity: 'high', priority: 9 }),
    ], 10);
    expect(out.map((i) => i.id)).toEqual(['high', 'med', 'pos']);
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
    expect(out.map((i) => i.id)).toEqual(['weakest', 'other']);
  });
});

describe('computeInsights', () => {
  it('returns [] for an empty snapshot (all generators gated off)', () => {
    expect(computeInsights(emptySnapshot)).toEqual([]);
  });
});

describe('focus generators', () => {
  it('weakest-subject fires for the lowest-readiness subject with enough data', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('p', 'Physics'), subj('c', 'Chemistry')],
      sessions: [sess('p', '2026-06-05T08:00:00'), sess('p', '2026-06-06T08:00:00'), sess('c', '2026-06-06T09:00:00')],
      readiness: { overall: 50, bySubject: { p: 70, c: 30 } },
    });
    const weak = out.find((i) => i.id === 'weakest-subject');
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
    expect(out.find((i) => i.id === 'weakest-subject')).toBeUndefined();
  });

  it('srs-backlog fires when ≥10 cards are due', () => {
    const cards = Array.from({ length: 11 }, (_, n) => ({
      id: 'c' + n, topicId: 't', userId: 'u', ease: 2.5, intervalDays: 1, dueDate: '2026-06-01', reps: 1,
    }));
    const out = ci({ ...emptySnapshot, srsCards: cards });
    const b = out.find((i) => i.id === 'srs-backlog');
    expect(b?.titleArgs).toEqual([11]);
  });

  it('neglected-subject fires for a topic-bearing subject idle ≥7 days (given recent activity)', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('p', 'Physics'), subj('c', 'Chemistry')],
      topics: [{ id: 't1', subjectId: 'p', name: 'Kinematics', orderIndex: 0 }],
      sessions: [sess('p', '2026-05-28T08:00:00'), sess('c', '2026-06-06T08:00:00')],
      readiness: { overall: 50, bySubject: { p: 60, c: 60 } },
    });
    const n = out.find((i) => i.id === 'neglected-subject');
    expect(n?.titleArgs).toEqual(['Physics']);
    expect(n?.bodyArgs).toEqual([10]);
  });
});

describe('pace generators', () => {
  const threeSessions = [
    sess('p', '2026-06-04T08:00:00'), sess('p', '2026-06-05T08:00:00'), sess('p', '2026-06-06T08:00:00'),
  ];
  it('readiness-gap fires when exam set and overall < 60 (with study history)', () => {
    const out = ci({
      ...emptySnapshot, subjects: [subj('p', 'Physics')], sessions: threeSessions,
      examDate: '2026-07-01', readiness: { overall: 45, bySubject: { p: 45 } },
    });
    expect(out.find((i) => i.id === 'readiness-gap')?.titleArgs).toEqual([45]);
  });
  it('readiness-gap is null without an exam date', () => {
    const out = ci({
      ...emptySnapshot, subjects: [subj('p', 'Physics')], sessions: threeSessions,
      examDate: null, readiness: { overall: 45, bySubject: { p: 45 } },
    });
    expect(out.find((i) => i.id === 'readiness-gap')).toBeUndefined();
  });
  it('exam-countdown fires within 60 days and is high severity inside 14', () => {
    const out = ci({ ...emptySnapshot, examDate: '2026-06-15' }); // 8 days from 06-07
    const c = out.find((i) => i.id === 'exam-countdown');
    expect(c?.titleArgs).toEqual([8]);
    expect(c?.severity).toBe('high');
  });
  it('exam-countdown is null when the exam is >60 days away', () => {
    const out = ci({ ...emptySnapshot, examDate: '2026-12-31' });
    expect(out.find((i) => i.id === 'exam-countdown')).toBeUndefined();
  });
});

describe('trends generators', () => {
  it('score-trend reports the subject with the largest absolute change (up)', () => {
    const out = ci({
      ...emptySnapshot, subjects: [subj('b', 'Biology')],
      scores: [score('b', '2026-05-01', 50), score('b', '2026-05-10', 50), score('b', '2026-06-01', 70)],
    });
    const t = out.find((i) => i.id === 'score-trend');
    expect(t?.titleKey).toBe('trendUpTitle');
    expect(t?.titleArgs).toEqual(['Biology']);
    expect(t?.bodyArgs).toEqual([20]);
  });

  it('score-trend is null with fewer than 2 scores', () => {
    const out = ci({ ...emptySnapshot, subjects: [subj('b', 'Biology')], scores: [score('b', '2026-06-01', 70)] });
    expect(out.find((i) => i.id === 'score-trend')).toBeUndefined();
  });

  it('time-balance flags a hogging subject vs an underserved topic-bearing one', () => {
    const out = ci({
      ...emptySnapshot,
      subjects: [subj('m', 'Math'), subj('e', 'English')],
      topics: [{ id: 't', subjectId: 'e', name: 'Grammar', orderIndex: 0 }],
      sessions: [
        sess('m', '2026-06-06T08:00:00'), sess('m', '2026-06-06T09:00:00'), sess('m', '2026-06-05T08:00:00'),
      ],
    });
    const b = out.find((i) => i.id === 'time-balance');
    expect(b?.bodyArgs).toEqual(['Math', 'English']);
  });
});

describe('momentum generators', () => {
  it('active-streak nudges to study when today has no session', () => {
    const out = ci({ ...emptySnapshot, streak: 5, sessions: [sess('p', '2026-06-06T08:00:00')] });
    const st = out.find((i) => i.id === 'active-streak');
    expect(st?.titleArgs).toEqual([5]);
    expect(st?.bodyKey).toBe('streakTodayBody');
    expect(st?.action?.href).toBe('/timer');
  });

  it('active-streak has no action once today is studied', () => {
    const out = ci({ ...emptySnapshot, streak: 5, sessions: [sess('p', '2026-06-07T08:00:00')] });
    const st = out.find((i) => i.id === 'active-streak');
    expect(st?.bodyKey).toBe('streakKeepBody');
    expect(st?.action).toBeUndefined();
  });

  it('goal-adherence counts days hitting the daily goal in the last 7', () => {
    const out = ci({
      ...emptySnapshot, dailyGoalHours: 1.5,
      sessions: [
        { ...sess('p', '2026-06-06T08:00:00'), durationSec: 3600 },
        { ...sess('p', '2026-06-06T10:00:00'), durationSec: 3600 },
      ],
    });
    expect(out.find((i) => i.id === 'goal-adherence')?.titleArgs).toEqual([1]);
  });

  it('goal-adherence is null when no day reached the goal', () => {
    const out = ci({
      ...emptySnapshot, dailyGoalHours: 4,
      sessions: [{ ...sess('p', '2026-06-06T08:00:00'), durationSec: 1800 }],
    });
    expect(out.find((i) => i.id === 'goal-adherence')).toBeUndefined();
  });
});
