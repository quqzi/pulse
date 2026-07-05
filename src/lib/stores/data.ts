import { derived } from 'svelte/store';
import type { AuthState } from '$lib/stores/auth';
import {
  subjects, topics, sessions, tasks, templates, scheduleSlots, scores, examQuestions, examSessions, flashcards, notes,
} from '$lib/data/stores';
import { tasksRepo, scoresRepo, templatesRepo, subjectsRepo, topicsRepo, sessionsRepo, scheduleRepo, examQuestionsRepo, examSessionsRepo, flashcardsRepo, notesRepo } from '$lib/data/entities';
import { computeInsights } from '$lib/insights';
import { subjectCoverage, examAccuracy, type ExamAttempt } from '$lib/data/readiness-util';
import { deckState, isDeckDue } from '$lib/flashcards';
import { localDateStr } from '$lib/utils';
import { settings } from '$lib/stores/settings';
import { todayDate } from '$lib/stores/clock';

// Re-export so existing `import { tasks } from '$lib/stores/data'` keeps working.
export { subjects, topics, sessions, tasks, templates, scheduleSlots, scores, examQuestions, examSessions, flashcards, notes };
export { authCtx, getAuthContext } from '$lib/data/authctx';

export const todaysSessions = derived([sessions, todayDate], ([$s, $today]) =>
  $s.filter(s => localDateStr(new Date(s.startedAt)) === $today)
);

export const todayHours = derived(todaysSessions, ($s) =>
  $s.reduce((sum, s) => sum + s.durationSec / 3600, 0)
);

export const streak = derived([sessions, todayDate], ([$s, $today]) => {
  if ($s.length === 0) return 0;
  const days = new Set($s.map(s => localDateStr(new Date(s.startedAt))));
  let count = 0;
  const d = new Date($today + 'T00:00:00');
  let base = localDateStr(d);
  if (!days.has(base)) {
    d.setDate(d.getDate() - 1);
    base = localDateStr(d);
    if (!days.has(base)) return 0;
  }
  while (days.has(base)) {
    count++;
    d.setDate(d.getDate() - 1);
    base = localDateStr(d);
  }
  return count;
});

export const tasksDueToday = derived([tasks, todayDate], ([$tasks, $today]) =>
  $tasks.filter(t => !t.completedAt && t.dueDate && t.dueDate <= $today)
);

// Decks (topics with cards) that are new or due today.
export const dueDecks = derived([topics, flashcards, todayDate], ([$topics, $flashcards, $today]) => {
  const countFor = (id: string) => $flashcards.filter(c => c.topicId === id).length;
  return $topics.filter(tp => isDeckDue(deckState(tp.nextStudyDate, countFor(tp.id), $today)));
});

// Per-subject + overall exam readiness (0–100), blending topic coverage,
// recent study hours, and mock-exam accuracy.
export const readinessScore = derived(
  [subjects, topics, sessions, scores, examSessions, settings, todayDate],
  ([$subjects, $topics, $sessions, $scores, $examSessions, $settings, $today]) => {
    const hoursTarget = Math.max(1, $settings.readinessHoursTarget || 20);
    const empty = { coverage: 0, hours: 0, exam: 0 };
    const emptyStats: ReadinessStats = {
      topicsDone: 0, topicsTotal: 0, recentHours: 0, hoursTarget, examCount: 0, examAccuracy: 0,
    };
    if ($subjects.length === 0) {
      return {
        overall: 0,
        bySubject: {} as Record<string, number>,
        parts: empty,
        partsBySubject: {} as Record<string, ReadinessParts>,
        stats: emptyStats,
        statsBySubject: {} as Record<string, ReadinessStats>,
      };
    }

    const cutoff = new Date(new Date($today + 'T00:00:00').getTime() - 30 * 24 * 60 * 60 * 1000);
    const bySubject: Record<string, number> = {};
    const partsBySubject: Record<string, ReadinessParts> = {};
    const statsBySubject: Record<string, ReadinessStats> = {};
    // Subjects with no topics, no recent hours, and no exam attempts are "not
    // started" — they keep a 0 entry in bySubject but stay out of the overall
    // average so adding a fresh subject doesn't tank the score.
    const activeIds: string[] = [];

    for (const subj of $subjects) {
      const subjTopics = $topics.filter(t => t.subjectId === subj.id);
      const coverage = subjectCoverage(subjTopics);

      const recentSecs = $sessions
        .filter(s => s.subjectId === subj.id && new Date(s.startedAt) >= cutoff)
        .reduce((sum, s) => sum + s.durationSec, 0);
      const recentHours = recentSecs / 3600;
      const hoursScore = Math.min(recentHours / hoursTarget, 1);

      // Exam attempts = in-app exam sessions ∪ manually logged mock scores.
      const attempts: ExamAttempt[] = [];
      for (const es of $examSessions) {
        const sub = es.subjectScores[subj.id];
        if (sub && sub.total > 0) attempts.push({ ratio: sub.correct / sub.total, date: es.createdAt });
      }
      for (const sc of $scores) {
        if (sc.subjectId === subj.id && sc.maxScore > 0) attempts.push({ ratio: sc.score / sc.maxScore, date: sc.takenAt });
      }
      const examScore = examAccuracy(attempts);

      if (subjTopics.length > 0 || recentSecs > 0 || attempts.length > 0) activeIds.push(subj.id);

      // Earned points out of the 40/30/30 split — the breakdown the UI visualizes.
      const parts = {
        coverage: Math.round(coverage * 40),
        hours: Math.round(hoursScore * 30),
        exam: Math.round(examScore * 30),
      };
      partsBySubject[subj.id] = parts;
      bySubject[subj.id] = parts.coverage + parts.hours + parts.exam;
      statsBySubject[subj.id] = {
        topicsDone: subjTopics.filter(t => t.done).length,
        topicsTotal: subjTopics.length,
        recentHours: Math.round(recentHours * 10) / 10,
        hoursTarget,
        examCount: attempts.length,
        examAccuracy: Math.round(examScore * 100),
      };
    }

    const avg = (k: keyof ReadinessParts) =>
      activeIds.length === 0
        ? 0
        : Math.round(activeIds.reduce((a, id) => a + partsBySubject[id][k], 0) / activeIds.length);
    const parts = { coverage: avg('coverage'), hours: avg('hours'), exam: avg('exam') };

    const all = Object.values(statsBySubject);
    const sum = (k: 'topicsDone' | 'topicsTotal' | 'recentHours' | 'examCount') =>
      all.reduce((a, s) => a + s[k], 0);
    const stats: ReadinessStats = {
      topicsDone: sum('topicsDone'),
      topicsTotal: sum('topicsTotal'),
      recentHours: Math.round(sum('recentHours') * 10) / 10,
      hoursTarget: hoursTarget * $subjects.length,
      examCount: sum('examCount'),
      examAccuracy:
        activeIds.length === 0
          ? 0
          : Math.round(activeIds.reduce((a, id) => a + statsBySubject[id].examAccuracy, 0) / activeIds.length),
    };

    return { overall: parts.coverage + parts.hours + parts.exam, bySubject, parts, partsBySubject, stats, statsBySubject };
  }
);

export interface ReadinessParts { coverage: number; hours: number; exam: number }
export interface ReadinessStats {
  topicsDone: number;
  topicsTotal: number;
  recentHours: number;   // last 30 days
  hoursTarget: number;   // hours for a full hours score
  examCount: number;     // exam sessions counted for this scope
  examAccuracy: number;  // 0–100 average
}

// Study-coach feed: runs the pure insight generators over current store state.
// Purely derived — no persistence, identical in guest and authenticated mode.
export const insights = derived(
  [subjects, topics, dueDecks, sessions, scores, examSessions, readinessScore, streak, settings, todayDate],
  ([$subjects, $topics, $dueDecks, $sessions, $scores, $examSessions, $readiness, $streak, $settings, $today]) =>
    computeInsights({
      subjects: $subjects,
      topics: $topics,
      dueDeckCount: $dueDecks.length,
      sessions: $sessions,
      scores: $scores,
      examSessions: $examSessions,
      readiness: $readiness,
      streak: $streak,
      dailyGoalHours: $settings.dailyGoalHours,
      examDate: $settings.examDate,
      today: $today,
    }),
);

export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  await Promise.all([
    tasksRepo.load(),
    scoresRepo.load(),
    subjectsRepo.load(),
    topicsRepo.load(),
    sessionsRepo.load(),
    templatesRepo.load(),
    examQuestionsRepo.load(),
    examSessionsRepo.load(),
    flashcardsRepo.load(),
    notesRepo.load(),
  ]);
}

export async function loadScheduleSlots(weekStart: Date, weekEnd: Date): Promise<void> {
  // Slots are stored as local wall-clock strings (toLocalISO, no timezone), so the
  // window bounds must be local-naive too. toISOString() would shift them by the
  // machine's UTC offset and misfile slots near the Sun/Mon week boundary.
  await scheduleRepo.loadWeek(
    `${localDateStr(weekStart)}T00:00:00`,
    `${localDateStr(weekEnd)}T00:00:00`,
  );
}
