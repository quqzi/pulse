import { derived } from 'svelte/store';
import type { AuthState } from '$lib/stores/auth';
import {
  subjects, topics, srsCards, sessions, tasks, templates, scheduleSlots, scores, examQuestions, examSessions, flashcards,
} from '$lib/data/stores';
import { tasksRepo, scoresRepo, templatesRepo, subjectsRepo, topicsRepo, srsRepo, sessionsRepo, scheduleRepo, examQuestionsRepo, examSessionsRepo, flashcardsRepo } from '$lib/data/entities';
import { computeInsights } from '$lib/insights';
import { subjectCoverage } from '$lib/data/readiness-util';
import { deckState, isDeckDue } from '$lib/flashcards';
import { localDateStr } from '$lib/utils';
import { settings } from '$lib/stores/settings';

// Re-export so existing `import { tasks } from '$lib/stores/data'` keeps working.
export { subjects, topics, srsCards, sessions, tasks, templates, scheduleSlots, scores, examQuestions, examSessions, flashcards };
export { authCtx, getAuthContext } from '$lib/data/authctx';

export const todaysSessions = derived(sessions, ($s) => {
  const today = localDateStr(new Date());
  return $s.filter(s => localDateStr(new Date(s.startedAt)) === today);
});

export const dueCards = derived(srsCards, ($cards) => {
  const today = localDateStr(new Date());
  return $cards.filter(c => c.dueDate <= today);
});

export const todayHours = derived(todaysSessions, ($s) =>
  $s.reduce((sum, s) => sum + s.durationSec / 3600, 0)
);

export const streak = derived(sessions, ($s) => {
  if ($s.length === 0) return 0;
  const days = new Set($s.map(s => localDateStr(new Date(s.startedAt))));
  let count = 0;
  const d = new Date();
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

export const tasksDueToday = derived(tasks, ($tasks) => {
  const today = localDateStr(new Date());
  return $tasks.filter(t => !t.completedAt && t.dueDate && t.dueDate <= today);
});

// Decks (topics with cards) that are new or due today.
export const dueDecks = derived([topics, flashcards], ([$topics, $flashcards]) => {
  const today = localDateStr(new Date());
  const countFor = (id: string) => $flashcards.filter(c => c.topicId === id).length;
  return $topics.filter(tp => isDeckDue(deckState(tp.nextStudyDate, countFor(tp.id), today)));
});

// Per-subject + overall exam readiness (0–100), blending topic coverage,
// recent study hours, and mock-exam accuracy.
export const readinessScore = derived(
  [subjects, topics, sessions, examSessions],
  ([$subjects, $topics, $sessions, $examSessions]) => {
    if ($subjects.length === 0) return { overall: 0, bySubject: {} as Record<string, number> };

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bySubject: Record<string, number> = {};

    for (const subj of $subjects) {
      const coverage = subjectCoverage($topics.filter(t => t.subjectId === subj.id));

      const recentSecs = $sessions
        .filter(s => s.subjectId === subj.id && new Date(s.startedAt) >= cutoff)
        .reduce((sum, s) => sum + s.durationSec, 0);
      const hoursScore = Math.min(recentSecs / 3600 / 20, 1);

      const examRatios = $examSessions
        .map(es => {
          const sub = es.subjectScores[subj.id];
          return sub && sub.total > 0 ? sub.correct / sub.total : null;
        })
        .filter((r): r is number => r !== null);
      const examScore = examRatios.length === 0 ? 0 : examRatios.reduce((a, b) => a + b, 0) / examRatios.length;

      bySubject[subj.id] = Math.round((coverage * 0.4 + hoursScore * 0.3 + examScore * 0.3) * 100);
    }

    const overall = Math.round(
      Object.values(bySubject).reduce((a, b) => a + b, 0) / $subjects.length
    );
    return { overall, bySubject };
  }
);

// Study-coach feed: runs the pure insight generators over current store state.
// Purely derived — no persistence, identical in guest and authenticated mode.
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

export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  await Promise.all([
    tasksRepo.load(),
    scoresRepo.load(),
    subjectsRepo.load(),
    topicsRepo.load(),
    srsRepo.load(),
    sessionsRepo.load(),
    templatesRepo.load(),
    examQuestionsRepo.load(),
    examSessionsRepo.load(),
    flashcardsRepo.load(),
  ]);
}

export async function loadScheduleSlots(weekStart: Date, weekEnd: Date): Promise<void> {
  await scheduleRepo.loadWeek(
    weekStart.toISOString().substring(0, 19),
    weekEnd.toISOString().substring(0, 19),
  );
}
