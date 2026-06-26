import type { Task, MockScore, Template, SubjectPreset, Subject, Topic, SrsCard, StudySession, ScheduleSlot, ExamQuestion, ExamSession, Flashcard, Note } from '$lib/types';

export const taskFromRow = (r: Record<string, unknown>): Task => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: (r.subject_id as string | null) ?? undefined,
  title: r.title as string,
  priority: r.priority as Task['priority'],
  dueDate: (r.due_date as string | null) ?? undefined,
  repeat: (r.repeat as Task['repeat'] | null) ?? undefined,
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
  repeat: t.repeat ?? null,
  completed_at: t.completedAt ?? null,
  created_at: t.createdAt,
});

export const noteFromRow = (r: Record<string, unknown>): Note => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: (r.subject_id as string | null) ?? undefined,
  title: r.title as string,
  body: r.body as string,
  tags: (r.tags as string[] | null) ?? [],
  pinned: (r.pinned as boolean | null) ?? false,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const noteToRow = (n: Note): Record<string, unknown> => ({
  id: n.id,
  user_id: n.userId,
  subject_id: n.subjectId ?? null,
  title: n.title,
  body: n.body,
  tags: n.tags,
  pinned: n.pinned,
  created_at: n.createdAt,
  updated_at: n.updatedAt,
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

export const topicFromRow = (r: Record<string, unknown>): Topic => ({
  id: r.id as string,
  subjectId: r.subject_id as string,
  name: r.name as string,
  orderIndex: r.order_index as number,
  done: (r.done as boolean | null) ?? false,
  note: (r.note as string | null) ?? undefined,
  nextStudyDate: (r.next_study_date as string | null) ?? undefined,
});

export const topicToRow = (t: Topic): Record<string, unknown> => ({
  id: t.id,
  subject_id: t.subjectId,
  // user_id is injected by topicsRepo.save/create (Topic has no userId field; guest rows never carry it).
  name: t.name,
  order_index: t.orderIndex,
  done: t.done ?? false,
  note: t.note ?? null,
  next_study_date: t.nextStudyDate ?? null,
});

export const flashcardFromRow = (r: Record<string, unknown>): Flashcard => ({
  id: r.id as string,
  userId: r.user_id as string,
  topicId: r.topic_id as string,
  front: r.front as string,
  back: r.back as string,
  createdAt: r.created_at as string,
});

export const flashcardToRow = (f: Flashcard): Record<string, unknown> => ({
  id: f.id,
  user_id: f.userId,
  topic_id: f.topicId,
  front: f.front,
  back: f.back,
  created_at: f.createdAt,
});

export const cardFromRow = (r: Record<string, unknown>): SrsCard => ({
  id: r.id as string,
  topicId: r.topic_id as string,
  userId: r.user_id as string,
  ease: r.ease as number,
  intervalDays: r.interval_days as number,
  dueDate: (r.due_date as string).split('T')[0],
  reps: r.reps as number,
});

export const cardToRow = (c: SrsCard): Record<string, unknown> => ({
  id: c.id,
  topic_id: c.topicId,
  user_id: c.userId,
  ease: c.ease,
  interval_days: c.intervalDays,
  due_date: c.dueDate,
  reps: c.reps,
});

export const sessionFromRow = (r: Record<string, unknown>): StudySession => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: r.subject_id as string,
  topicId: (r.topic_id as string | null) ?? undefined,
  startedAt: r.started_at as string,
  endedAt: r.ended_at as string,
  durationSec: r.duration_sec as number,
  mode: r.mode as StudySession['mode'],
});

export const sessionToRow = (s: StudySession): Record<string, unknown> => ({
  id: s.id,
  user_id: s.userId,
  subject_id: s.subjectId,
  topic_id: s.topicId ?? null,
  started_at: s.startedAt,
  ended_at: s.endedAt,
  duration_sec: s.durationSec,
  mode: s.mode,
});

const toLocal = (s: string) => s.replace(/\+.*$|Z$/, '').replace(' ', 'T').substring(0, 19);

export const slotFromRow = (r: Record<string, unknown>): ScheduleSlot => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: (r.subject_id as string | null) ?? undefined,
  topicId: (r.topic_id as string | null) ?? undefined,
  startTime: toLocal(r.start_time as string),
  endTime: toLocal(r.end_time as string),
  isAiSuggested: r.is_ai_suggested as boolean,
  isConfirmed: r.is_confirmed as boolean,
  isFocusBlock: r.is_focus_block as boolean,
  isRecurring: r.is_recurring as boolean,
  recurrenceDays: (r.recurrence_days as number[]) ?? [],
  recurrenceEndDate: (r.recurrence_end as string | null) ?? undefined,
  createdAt: r.created_at as string,
});

export const slotToRow = (s: ScheduleSlot): Record<string, unknown> => ({
  id: s.id,
  user_id: s.userId,
  subject_id: s.subjectId ?? null,
  topic_id: s.topicId ?? null,
  start_time: s.startTime,
  end_time: s.endTime,
  is_ai_suggested: s.isAiSuggested,
  is_confirmed: s.isConfirmed,
  is_focus_block: s.isFocusBlock,
  is_recurring: s.isRecurring,
  recurrence_days: s.recurrenceDays,
  recurrence_end: s.recurrenceEndDate ?? null,
  created_at: s.createdAt,
});

export const examQuestionFromRow = (r: Record<string, unknown>): ExamQuestion => ({
  id: r.id as string,
  userId: r.user_id as string,
  text: r.text as string,
  choices: r.choices as [string, string, string, string],
  correctIndex: r.correct_index as 0 | 1 | 2 | 3,
  subject: r.subject as string,
  difficulty: r.difficulty as ExamQuestion['difficulty'],
  year: (r.year as number | null) ?? undefined,
  imageUrl: (r.image_url as string | null) ?? undefined,
  createdAt: r.created_at as string,
});

export const examQuestionToRow = (q: ExamQuestion): Record<string, unknown> => ({
  id: q.id,
  user_id: q.userId,
  text: q.text,
  choices: q.choices,
  correct_index: q.correctIndex,
  subject: q.subject,
  difficulty: q.difficulty,
  year: q.year ?? null,
  image_url: q.imageUrl ?? null,
  created_at: q.createdAt,
});

export const examSessionFromRow = (r: Record<string, unknown>): ExamSession => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectScores: r.subject_scores as Record<string, { correct: number; total: number }>,
  totalCorrect: r.total_correct as number,
  totalQuestions: r.total_questions as number,
  durationSeconds: r.duration_seconds as number,
  timerMode: r.timer_mode as ExamSession['timerMode'],
  createdAt: r.created_at as string,
});

export const examSessionToRow = (s: ExamSession): Record<string, unknown> => ({
  id: s.id,
  user_id: s.userId,
  subject_scores: s.subjectScores,
  total_correct: s.totalCorrect,
  total_questions: s.totalQuestions,
  duration_seconds: s.durationSeconds,
  timer_mode: s.timerMode,
  created_at: s.createdAt,
});
