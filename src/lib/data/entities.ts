import type { Task, MockScore, Template } from '$lib/types';
import { tasks, scores, templates } from '$lib/data/stores';
import { repo } from '$lib/data/repository';
import { taskFromRow, taskToRow, scoreFromRow, scoreToRow, templateFromRow, templateToRow } from '$lib/data/mappers';

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

export const templatesRepo = repo<Template>({
  store: templates,
  lsKey: 'pulse.templates',
  table: 'templates',
  toRow: templateToRow,
  fromRow: templateFromRow,
  orderColumn: 'created_at',
  ascending: false,
  order: (a, b) => b.createdAt.localeCompare(a.createdAt),
});
