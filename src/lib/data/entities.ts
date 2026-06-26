import { get } from 'svelte/store';
import type { Task, MockScore, Template, Subject, Topic, StudySession, ScheduleSlot, ExamQuestion, ExamSession, Flashcard, Note } from '$lib/types';
import { tasks, scores, templates, subjects, topics, sessions, scheduleSlots, examQuestions, examSessions, flashcards, notes } from '$lib/data/stores';
import { repo, reportError } from '$lib/data/repository';
import { writeThrough, loadInto } from '$lib/data/engine';
import { taskFromRow, taskToRow, scoreFromRow, scoreToRow, templateFromRow, templateToRow, subjectFromRow, subjectToRow, topicFromRow, topicToRow, sessionFromRow, sessionToRow, slotFromRow, slotToRow, examQuestionFromRow, examQuestionToRow, examSessionFromRow, examSessionToRow, flashcardFromRow, flashcardToRow, noteFromRow, noteToRow } from '$lib/data/mappers';
import { getAuthContext } from '$lib/data/authctx';
import { toast } from '$lib/stores/toast';
import { t } from '$lib/i18n';
import { lsWrite, lsRead } from '$lib/data/ls';
import { supabase } from '$lib/supabase';
import { HISTORY_DAYS } from '$lib/constants';

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

export const notesRepo = repo<Note>({
  store: notes,
  lsKey: 'pulse.notes',
  table: 'notes',
  toRow: noteToRow,
  fromRow: noteFromRow,
  orderColumn: 'updated_at',
  ascending: false,
  order: (a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  },
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

export const examQuestionsRepo = repo<ExamQuestion>({
  store: examQuestions,
  lsKey: 'pulse.examQuestions',
  table: 'exam_questions',
  toRow: examQuestionToRow,
  fromRow: examQuestionFromRow,
  orderColumn: 'created_at',
  ascending: false,
  order: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

export const examSessionsRepo = repo<ExamSession>({
  store: examSessions,
  lsKey: 'pulse.examSessions',
  table: 'exam_sessions',
  toRow: examSessionToRow,
  fromRow: examSessionFromRow,
  orderColumn: 'created_at',
  ascending: false,
  order: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

export const flashcardsRepo = repo<Flashcard>({
  store: flashcards,
  lsKey: 'pulse.flashcards',
  table: 'flashcards',
  toRow: flashcardToRow,
  fromRow: flashcardFromRow,
  orderColumn: 'created_at',
  ascending: true,
  order: (a, b) => a.createdAt.localeCompare(b.createdAt),
});

const subjectsBase = repo<Subject>({
  store: subjects,
  lsKey: 'pulse.subjects',
  table: 'subjects',
  toRow: subjectToRow,
  fromRow: subjectFromRow,
  orderColumn: 'order_index',
  ascending: true,
  order: (a, b) => a.orderIndex - b.orderIndex,
});

export const subjectsRepo = {
  load: subjectsBase.load,
  save: subjectsBase.save,
  // Subjects are only ever deleted via removeCascade; the bare engine `remove` (which would orphan
  // topics/cards) is intentionally not exposed (mirrors topicsRepo).
  /**
   * Delete a subject and its dependents. Guest: purge topics + their flashcards in localStorage.
   * Auth: delete the subject; the DB FK cascade removes topics/flashcards (and sessions/schedule/scores).
   * Stores refreshed for subjects/topics/flashcards only (sessions/scores resync on next loadData).
   */
  async removeCascade(id: string): Promise<void> {
    const { mode } = getAuthContext();
    const snapSub = get(subjects);
    const snapTop = get(topics);
    const snapFc = get(flashcards);
    const removedTopicIds = new Set(snapTop.filter(tp => tp.subjectId === id).map(tp => tp.id));

    subjects.set(snapSub.filter(s => s.id !== id));
    topics.set(snapTop.filter(tp => tp.subjectId !== id));
    flashcards.set(snapFc.filter(c => !removedTopicIds.has(c.topicId)));

    try {
      if (mode === 'guest') {
        lsWrite('pulse.subjects', get(subjects));
        lsWrite('pulse.topics', get(topics));
        lsWrite('pulse.flashcards', get(flashcards));
      } else {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) throw error;
      }
    } catch {
      subjects.set(snapSub);
      topics.set(snapTop);
      flashcards.set(snapFc);
      toast.error(get(t).common.errDelete);
    }
  },
};

// Cascade / multi-store methods below use an explicit inline snapshot/rollback pattern by design —
// writeThrough() covers only a single store and cannot atomically roll back multiple stores.

const topicOrder = (a: Topic, b: Topic) => a.orderIndex - b.orderIndex;

const topicsBase = repo<Topic>({
  store: topics,
  lsKey: 'pulse.topics',
  table: 'topics',
  toRow: topicToRow,
  fromRow: topicFromRow,
  orderColumn: 'order_index',
  ascending: true,
  order: topicOrder,
});

export const topicsRepo = {
  load: topicsBase.load,

  /** Topic edit (name/order). Injects user_id (required NOT NULL) from authCtx for the auth UPSERT. */
  async save(topic: Topic): Promise<void> {
    const { userId, mode } = getAuthContext();
    await writeThrough(
      topics,
      (arr) => arr.map(tp => (tp.id === topic.id ? topic : tp)),
      async () => {
        if (mode === 'guest') lsWrite('pulse.topics', get(topics));
        else {
          const { error } = await supabase.from('topics').upsert({ ...topicToRow(topic), user_id: userId });
          if (error) throw error;
        }
      },
      { order: topicOrder, onError: reportError },
    );
  },

  /** Add (or upsert) a topic. */
  async create(topic: Topic): Promise<void> {
    const { userId, mode } = getAuthContext();
    const snapTop = get(topics);
    topics.set([...snapTop.filter(tp => tp.id !== topic.id), topic].sort(topicOrder));

    try {
      if (mode === 'guest') {
        lsWrite('pulse.topics', get(topics));
      } else {
        const { error } = await supabase.from('topics').upsert({ ...topicToRow(topic), user_id: userId });
        if (error) throw error;
      }
    } catch {
      topics.set(snapTop);
      toast.error(get(t).common.errSave);
    }
  },

  /** Delete a topic and its flashcards. Guest purges localStorage; auth relies on the flashcards FK cascade. */
  async removeCascade(id: string): Promise<void> {
    const { mode } = getAuthContext();
    const snapTop = get(topics);
    const snapFc = get(flashcards);
    topics.set(snapTop.filter(tp => tp.id !== id));
    flashcards.set(snapFc.filter(c => c.topicId !== id));
    try {
      if (mode === 'guest') {
        lsWrite('pulse.topics', get(topics));
        lsWrite('pulse.flashcards', get(flashcards));
      } else {
        const { error } = await supabase.from('topics').delete().eq('id', id);
        if (error) throw error;
      }
    } catch {
      topics.set(snapTop);
      flashcards.set(snapFc);
      toast.error(get(t).common.errDelete);
    }
  },
};

const sessionOrder = (a: StudySession, b: StudySession) => b.startedAt.localeCompare(a.startedAt);

const sessionsBase = repo<StudySession>({
  store: sessions,
  lsKey: 'pulse.sessions',
  table: 'study_sessions',
  toRow: sessionToRow,
  fromRow: sessionFromRow,
  orderColumn: 'started_at',
  ascending: false,
  order: sessionOrder,
});

export const sessionsRepo = {
  save: sessionsBase.save,     // UPSERT (analytics edit)
  remove: sessionsBase.remove,

  /** Windowed read: last HISTORY_DAYS (112) for both modes. */
  async load(): Promise<StudySession[]> {
    const { userId, mode } = getAuthContext();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);
    return loadInto(sessions, async () => {
      if (mode === 'guest') {
        const cutoffStr = cutoff.toISOString();
        return lsRead<StudySession>('pulse.sessions').filter(s => s.startedAt >= cutoffStr);
      }
      const { data, error } = await supabase.from('study_sessions').select('*')
        .eq('user_id', userId)
        .gte('started_at', cutoff.toISOString())
        .order('started_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(sessionFromRow);
    }, sessionOrder);
  },

  /** Newest-first INSERT (timer / dashboard quick-log). Distinct from save so a new row never UPSERTs over an edit. */
  async log(s: StudySession): Promise<void> {
    const { mode } = getAuthContext();
    await writeThrough(
      sessions,
      (arr) => [s, ...arr],
      async () => {
        if (mode === 'guest') lsWrite('pulse.sessions', get(sessions));
        else {
          const { error } = await supabase.from('study_sessions').insert(sessionToRow(s));
          if (error) throw error;
        }
      },
      { order: sessionOrder, onError: reportError },
    );
  },
};

const slotOrder = (a: ScheduleSlot, b: ScheduleSlot) => a.startTime.localeCompare(b.startTime);

const scheduleBase = repo<ScheduleSlot>({
  store: scheduleSlots,
  lsKey: 'pulse.scheduleSlots',
  table: 'schedule_slots',
  toRow: slotToRow,
  fromRow: slotFromRow,
  order: slotOrder,
});

export const scheduleRepo = {
  save: scheduleBase.save,
  remove: scheduleBase.remove,

  /** Windowed read for the viewed week. Lives outside loadData (called reactively per week). */
  async loadWeek(weekStart: string, weekEnd: string): Promise<ScheduleSlot[]> {
    const { userId, mode } = getAuthContext();
    return loadInto(scheduleSlots, async () => {
      if (mode === 'guest') {
        return lsRead<ScheduleSlot>('pulse.scheduleSlots').filter(s => s.startTime >= weekStart && s.startTime < weekEnd);
      }
      const { data, error } = await supabase.from('schedule_slots').select('*')
        .eq('user_id', userId)
        .gte('start_time', weekStart)
        .lt('start_time', weekEnd)
        .order('start_time');
      if (error) throw error;
      return (data ?? []).map(slotFromRow);
    }, slotOrder);
  },

  /** Bulk confirm: flip isConfirmed=true / isAiSuggested=false for the given slots, persist all, one store update. */
  async confirmAll(slots: ScheduleSlot[]): Promise<void> {
    const { mode } = getAuthContext();
    const ids = new Set(slots.map(s => s.id));
    await writeThrough(
      scheduleSlots,
      (arr) => arr.map(s => (ids.has(s.id) ? { ...s, isConfirmed: true, isAiSuggested: false } : s)),
      async () => {
        if (mode === 'guest') {
          // The store holds only the viewed week, but the localStorage key holds ALL weeks. AI-suggested
          // slots live only in the store until accepted, so UPSERT the confirmed slots (insert-if-absent)
          // into the full set — mapping over only existing rows would drop never-persisted suggestions.
          const byId = new Map(lsRead<ScheduleSlot>('pulse.scheduleSlots').map(s => [s.id, s]));
          for (const s of slots) byId.set(s.id, { ...s, isConfirmed: true, isAiSuggested: false });
          lsWrite('pulse.scheduleSlots', [...byId.values()]);
        } else {
          const rows = slots.map(s => slotToRow({ ...s, isConfirmed: true, isAiSuggested: false }));
          const { error } = await supabase.from('schedule_slots').upsert(rows);
          if (error) throw error;
        }
      },
      { order: slotOrder, onError: reportError },
    );
  },
};
