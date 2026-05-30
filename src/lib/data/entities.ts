import type { Task } from '$lib/types';
import type { MockScore } from '$lib/types';
import { tasks } from '$lib/data/stores';
import { scores } from '$lib/data/stores';
import { repo } from '$lib/data/repository';
import { taskFromRow, taskToRow } from '$lib/data/mappers';
import { scoreFromRow, scoreToRow } from '$lib/data/mappers';

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

export const scoresRepo = repo<MockScore>({
  store: scores,
  lsKey: 'pulse.scores',
  table: 'mock_scores',
  toRow: scoreToRow,
  fromRow: scoreFromRow,
  orderColumn: 'taken_at',
  ascending: false,
  order: (a, b) => b.takenAt.localeCompare(a.takenAt),
});
