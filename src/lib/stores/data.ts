import { derived, get } from 'svelte/store';
import { db } from '$lib/db';
import type { AuthState } from '$lib/stores/auth';
import {
  subjects, topics, srsCards, sessions, tasks, templates, scheduleSlots, scores,
} from '$lib/data/stores';
import { authCtx } from '$lib/data/authctx';
import { tasksRepo, scoresRepo, templatesRepo, subjectsRepo, topicsRepo, srsRepo } from '$lib/data/entities';

// Re-export so existing `import { tasks } from '$lib/stores/data'` keeps working.
export { subjects, topics, srsCards, sessions, tasks, templates, scheduleSlots, scores };
export { authCtx, getAuthContext } from '$lib/data/authctx';

export const todaysSessions = derived(sessions, ($s) => {
  const today = new Date().toISOString().split('T')[0];
  return $s.filter(s => s.startedAt.startsWith(today));
});

export const dueCards = derived(srsCards, ($cards) => {
  const today = new Date().toISOString().split('T')[0];
  return $cards.filter(c => c.dueDate <= today);
});

export const todayHours = derived(todaysSessions, ($s) =>
  $s.reduce((sum, s) => sum + s.durationSec / 3600, 0)
);

export const streak = derived(sessions, ($s) => {
  if ($s.length === 0) return 0;
  const days = new Set($s.map(s => s.startedAt.split('T')[0]));
  let count = 0;
  const d = new Date();
  let base = d.toISOString().split('T')[0];
  if (!days.has(base)) {
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
    if (!days.has(base)) return 0;
  }
  while (days.has(base)) {
    count++;
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
  }
  return count;
});

export const tasksDueToday = derived(tasks, ($tasks) => {
  const today = new Date().toISOString().split('T')[0];
  return $tasks.filter(t => !t.completedAt && t.dueDate && t.dueDate <= today);
});

export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  const userId = authState.mode === 'guest' ? 'guest' : (authState.user?.id ?? '');
  const mode = authState.mode;

  await Promise.all([
    tasksRepo.load(),
    scoresRepo.load(),
    subjectsRepo.load(),
    topicsRepo.load(),
    srsRepo.load(),
    db.getSessions(userId, mode).then(v => sessions.set(v)),
    templatesRepo.load(),
  ]);
}

export async function loadScheduleSlots(weekStart: Date, weekEnd: Date): Promise<void> {
  const { userId, mode } = get(authCtx);
  const slots = await db.getScheduleSlots(
    userId, mode,
    weekStart.toISOString().substring(0, 19),
    weekEnd.toISOString().substring(0, 19)
  );
  scheduleSlots.set(slots);
}
