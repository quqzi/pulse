import { get } from 'svelte/store';
import type { Task, MockScore, Template, Subject, Topic, SrsCard, StudySession, ScheduleSlot, ExamQuestion, ExamSession, Flashcard } from '$lib/types';
import { tasks, scores, templates, subjects, topics, srsCards, sessions, scheduleSlots, examQuestions, examSessions, flashcards } from '$lib/data/stores';
import { repo, reportError } from '$lib/data/repository';
import { writeThrough, loadInto } from '$lib/data/engine';
import { taskFromRow, taskToRow, scoreFromRow, scoreToRow, templateFromRow, templateToRow, subjectFromRow, subjectToRow, topicFromRow, topicToRow, cardFromRow, cardToRow, sessionFromRow, sessionToRow, slotFromRow, slotToRow, examQuestionFromRow, examQuestionToRow, examSessionFromRow, examSessionToRow, flashcardFromRow, flashcardToRow } from '$lib/data/mappers';
import { getAuthContext } from '$lib/data/authctx';
import { toast } from '$lib/stores/toast';
import { t } from '$lib/i18n';
import { lsWrite, lsRead } from '$lib/data/ls';
import { supabase } from '$lib/supabase';
import { newId } from '$lib/id';
import { defaultCard } from '$lib/srs';
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
   * Delete a subject and its dependents. Guest: purge topics + their cards in localStorage.
   * Auth: delete the subject; the DB FK cascade removes topics/cards (and sessions/schedule/scores).
   * Stores refreshed for subjects/topics/srsCards only (sessions/scores resync on next loadData) —
   * matches today's behavior exactly.
   */
  async removeCascade(id: string): Promise<void> {
    const { mode } = getAuthContext();
    const snapSub = get(subjects);
    const snapTop = get(topics);
    const snapCard = get(srsCards);
    const removedTopicIds = new Set(snapTop.filter(tp => tp.subjectId === id).map(tp => tp.id));

    subjects.set(snapSub.filter(s => s.id !== id));
    topics.set(snapTop.filter(tp => tp.subjectId !== id));
    srsCards.set(snapCard.filter(c => !removedTopicIds.has(c.topicId)));

    try {
      if (mode === 'guest') {
        lsWrite('pulse.subjects', get(subjects));
        lsWrite('pulse.topics', get(topics));
        lsWrite('pulse.srsCards', get(srsCards));
      } else {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) throw error;
      }
    } catch {
      subjects.set(snapSub);
      topics.set(snapTop);
      srsCards.set(snapCard);
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

  /** Add a topic and ensure exactly one SRS card for it. Returns the card. Idempotent on the card. */
  async create(topic: Topic): Promise<SrsCard> {
    const { userId, mode } = getAuthContext();
    const existing = get(srsCards).find(c => c.topicId === topic.id);
    const card: SrsCard = existing ?? { id: newId(), topicId: topic.id, userId, ...defaultCard() };

    const snapTop = get(topics);
    const snapCard = get(srsCards);
    topics.set([...snapTop.filter(tp => tp.id !== topic.id), topic].sort(topicOrder));
    if (!existing) srsCards.set([...snapCard, card]);

    try {
      if (mode === 'guest') {
        lsWrite('pulse.topics', get(topics));
        if (!existing) lsWrite('pulse.srsCards', get(srsCards));
      } else {
        const { error: te } = await supabase.from('topics').upsert({ ...topicToRow(topic), user_id: userId });
        if (te) throw te;
        if (!existing) {
          const { error: ce } = await supabase
            .from('srs_cards')
            .upsert(cardToRow(card), { onConflict: 'topic_id' });
          if (ce) throw ce;
        }
      }
    } catch {
      topics.set(snapTop);
      srsCards.set(snapCard);
      toast.error(get(t).common.errSave);
    }
    return card;
  },

  /** Delete a topic and its card. Guest purges localStorage; auth relies on the srs_cards FK cascade. */
  async removeCascade(id: string): Promise<void> {
    const { mode } = getAuthContext();
    const snapTop = get(topics);
    const snapCard = get(srsCards);
    topics.set(snapTop.filter(tp => tp.id !== id));
    srsCards.set(snapCard.filter(c => c.topicId !== id));
    try {
      if (mode === 'guest') {
        lsWrite('pulse.topics', get(topics));
        lsWrite('pulse.srsCards', get(srsCards));
      } else {
        const { error } = await supabase.from('topics').delete().eq('id', id);
        if (error) throw error;
      }
    } catch {
      topics.set(snapTop);
      srsCards.set(snapCard);
      toast.error(get(t).common.errDelete);
    }
  },
};

const srsBase = repo<SrsCard>({
  store: srsCards,
  lsKey: 'pulse.srsCards',
  table: 'srs_cards',
  toRow: cardToRow,
  fromRow: cardFromRow,
});

export const srsRepo = {
  load: srsBase.load,

  /** Update-only (never inserts); sets updated_at. SM-2 writes go here, not generic save. */
  async update(card: SrsCard): Promise<void> {
    const { mode } = getAuthContext();
    await writeThrough(
      srsCards,
      (arr) => arr.map(c => (c.id === card.id ? card : c)),
      async () => {
        if (mode === 'guest') lsWrite('pulse.srsCards', get(srsCards));
        else {
          const { error } = await supabase.from('srs_cards').update({
            ease: card.ease,
            interval_days: card.intervalDays,
            due_date: card.dueDate,
            reps: card.reps,
            updated_at: new Date().toISOString(),
          }).eq('id', card.id);
          if (error) throw error;
        }
      },
      { onError: reportError },
    );
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
