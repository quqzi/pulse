import { newId } from '$lib/id';
import { localDateStr } from '$lib/utils';
import type { Task } from '$lib/types';

// Next occurrence is always after today — a daily task overdue by a week
// re-spawns for tomorrow, not seven stale copies ago.
export function nextDueDate(task: Task, today: Date = new Date()): string {
  const step = task.repeat === 'daily' ? 1 : 7;
  const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : today;
  const d = new Date(Math.max(base.getTime(), today.getTime()));
  d.setDate(d.getDate() + step);
  return localDateStr(d);
}

export async function completeTask(task: Task): Promise<void> {
  // Lazy import keeps this module pure for unit tests — entities.ts pulls in
  // the Supabase client, which needs $env at module load.
  const { tasksRepo } = await import('$lib/data/entities');
  await tasksRepo.save({ ...task, completedAt: new Date().toISOString() });
  if (task.repeat) {
    await tasksRepo.save({
      ...task,
      id: newId(),
      completedAt: undefined,
      dueDate: nextDueDate(task),
      createdAt: new Date().toISOString(),
    });
  }
}
