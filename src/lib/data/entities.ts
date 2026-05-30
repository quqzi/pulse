import type { Task } from '$lib/types';
import { tasks } from '$lib/data/stores';
import { repo } from '$lib/data/repository';
import { taskFromRow, taskToRow } from '$lib/data/mappers';

export const tasksRepo = repo<Task>({
  store: tasks,
  lsKey: 'pulse.tasks',
  table: 'tasks',
  toRow: taskToRow,
  fromRow: taskFromRow,
  orderColumn: 'created_at',
  ascending: false,
  order: (a, b) => b.createdAt.localeCompare(a.createdAt),
});
