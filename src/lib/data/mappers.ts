import type { Task, MockScore, Template, SubjectPreset, Subject } from '$lib/types';

export const taskFromRow = (r: Record<string, unknown>): Task => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: (r.subject_id as string | null) ?? undefined,
  title: r.title as string,
  priority: r.priority as Task['priority'],
  dueDate: (r.due_date as string | null) ?? undefined,
  completedAt: (r.completed_at as string | null) ?? undefined,
  createdAt: r.created_at as string,
});

export const taskToRow = (t: Task): Record<string, unknown> => ({
  id: t.id,
  user_id: t.userId,
  subject_id: t.subjectId ?? null,
  title: t.title,
  priority: t.priority,
  due_date: t.dueDate ?? null,
  completed_at: t.completedAt ?? null,
  created_at: t.createdAt,
});

export const scoreFromRow = (r: Record<string, unknown>): MockScore => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: r.subject_id as string,
  score: r.score as number,
  maxScore: r.max_score as number,
  takenAt: (r.taken_at as string).split('T')[0],
  notes: (r.notes as string | null) ?? undefined,
  createdAt: r.created_at as string,
});

export const scoreToRow = (s: MockScore): Record<string, unknown> => ({
  id: s.id,
  user_id: s.userId,
  subject_id: s.subjectId,
  score: s.score,
  max_score: s.maxScore,
  taken_at: s.takenAt,
  notes: s.notes ?? null,
  created_at: s.createdAt,
});

export const templateFromRow = (r: Record<string, unknown>): Template => ({
  id: r.id as string,
  userId: r.user_id as string,
  name: r.name as string,
  presets: r.presets as SubjectPreset[],
  createdAt: r.created_at as string,
});

export const templateToRow = (t: Template): Record<string, unknown> => ({
  id: t.id,
  user_id: t.userId,
  name: t.name,
  presets: t.presets,
  created_at: t.createdAt,
});

export const subjectFromRow = (r: Record<string, unknown>): Subject => ({
  id: r.id as string,
  userId: r.user_id as string,
  name: r.name as string,
  symbol: r.symbol as string,
  color: r.color as string,
  colorRgb: r.color_rgb as string,
  orderIndex: r.order_index as number,
  targetScore: (r.target_score as number | null) ?? undefined,
});

export const subjectToRow = (s: Subject): Record<string, unknown> => ({
  id: s.id,
  user_id: s.userId,
  name: s.name,
  symbol: s.symbol,
  color: s.color,
  color_rgb: s.colorRgb,
  order_index: s.orderIndex,
  target_score: s.targetScore ?? null,
});
