import type { I18n } from '$lib/i18n/en';
import type { Subject, MockScore } from '$lib/types';
import type { Topic, StudySession, ExamSession } from '$lib/types';

export type InsightSeverity = 'high' | 'medium' | 'positive';
export type InsightKey = keyof I18n['insights'];

export interface InsightAction {
  labelKey: InsightKey;
  href: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  priority: number; // ascending tiebreak within a severity band
  icon: string;
  titleKey: InsightKey;
  titleArgs?: (string | number)[];
  bodyKey?: InsightKey;
  bodyArgs?: (string | number)[];
  action?: InsightAction;
  subjectId?: string; // present → participates in per-subject de-dup
}

export interface InsightSnapshot {
  subjects: Subject[];
  topics: Topic[];
  dueDeckCount: number;
  sessions: StudySession[];
  scores: MockScore[];
  examSessions: ExamSession[];
  readiness: { overall: number; bySubject: Record<string, number> };
  streak: number;
  dailyGoalHours: number;
  examDate: string | null; // YYYY-MM-DD | null
  today: string; // YYYY-MM-DD, injected by the store
}

export type Generator = (s: InsightSnapshot) => Insight | null;

// ── thresholds (tune in one place) ──────────────────────────────
export const CAP = 7;
const SEV_RANK: Record<InsightSeverity, number> = { high: 0, medium: 1, positive: 2 };

const MIN_SESSIONS = 3;
const NEGLECT_DAYS = 7;
const RECENT_ACTIVITY_DAYS = 14;
const DECKS_DUE_MIN = 3;
const READINESS_GAP_MAX = 60;
const EXAM_SOON_DAYS = 60;
const EXAM_URGENT_DAYS = 14;
const TIME_WINDOW_DAYS = 7;
const TIME_HOG_PCT = 0.5;
const TIME_UNDERSERVED_PCT = 0.1;
const STREAK_MIN = 2;
const GOAL_WINDOW_DAYS = 6; // last 7 days inclusive of today

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

/** Whole-day difference between two YYYY-MM-DD strings (to − from). */
export function dayDiff(fromDateStr: string, toDateStr: string): number {
  return Math.round(
    (new Date(toDateStr + 'T00:00:00').getTime() - new Date(fromDateStr + 'T00:00:00').getTime()) / 86400000,
  );
}

// ── generators ──────────────────────────────────────────────────

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
    if (days.length === 0) continue; // never studied → covered by weakest/readiness
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

const decksDue: Generator = (s) => {
  if (s.dueDeckCount < DECKS_DUE_MIN) return null;
  return {
    id: 'decks-due', severity: 'high', priority: 20, icon: '🗂️',
    titleKey: 'backlogTitle', titleArgs: [s.dueDeckCount], bodyKey: 'backlogBody',
    action: { labelKey: 'actionReview', href: '/flashcards' },
  };
};

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

export const GENERATORS: Generator[] = [
  weakestSubject, neglectedSubject, decksDue, readinessGap, examCountdown,
  scoreTrend, timeBalance, activeStreak, goalAdherence,
];

export function computeInsights(s: InsightSnapshot, cap = CAP): Insight[] {
  const raw = GENERATORS.map((g) => g(s)).filter((i): i is Insight => i !== null);
  return rankAndCap(raw, cap);
}
