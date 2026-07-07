import type { GoalMetric } from '$lib/types';

export interface AchievementInput {
  sessionCount: number;
  totalHours: number;
  streak: number;
  mockCount: number;
  bestMockAccuracy: number; // 0–100
  cardCount: number;
  tasksCompleted: number;
}

export interface Achievement {
  id: string;
  icon: string;
  unlocked: boolean;
  progress: number; // 0–1
  value: number;
  target: number;
}

const DEFS: { id: string; icon: string; target: number; metric: (i: AchievementInput) => number }[] = [
  { id: 'firstSession', icon: '🎯', target: 1, metric: i => i.sessionCount },
  { id: 'streak3', icon: '🔥', target: 3, metric: i => i.streak },
  { id: 'streak7', icon: '⚡', target: 7, metric: i => i.streak },
  { id: 'streak30', icon: '🏆', target: 30, metric: i => i.streak },
  { id: 'hours10', icon: '⏱️', target: 10, metric: i => i.totalHours },
  { id: 'hours50', icon: '📚', target: 50, metric: i => i.totalHours },
  { id: 'firstMock', icon: '📝', target: 1, metric: i => i.mockCount },
  { id: 'mock90', icon: '🌟', target: 90, metric: i => i.bestMockAccuracy },
  { id: 'tasks10', icon: '✅', target: 10, metric: i => i.tasksCompleted },
  { id: 'cards20', icon: '🧠', target: 20, metric: i => i.cardCount },
];

export const ACHIEVEMENT_IDS = DEFS.map(d => d.id);

export function computeAchievements(input: AchievementInput): Achievement[] {
  return DEFS.map(({ id, icon, target, metric }) => {
    const value = metric(input);
    return {
      id,
      icon,
      unlocked: value >= target,
      progress: Math.min(1, value / target),
      value: Math.floor(value),
      target,
    };
  });
}

const GOAL_METRICS: Record<GoalMetric, (i: AchievementInput) => number> = {
  sessions: (i) => i.sessionCount,
  hours: (i) => i.totalHours,
  streak: (i) => i.streak,
  mocks: (i) => i.mockCount,
  mockAccuracy: (i) => i.bestMockAccuracy,
  cards: (i) => i.cardCount,
  tasks: (i) => i.tasksCompleted,
};

/** Current value of the stat a custom goal tracks, from the same input as the built-ins. */
export function goalValue(metric: GoalMetric, input: AchievementInput): number {
  return GOAL_METRICS[metric](input);
}
