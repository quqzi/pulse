import { browser } from '$app/environment';
import { supabase } from '$lib/supabase';
import { TCAS_SUBJECTS } from '$lib/constants';
import type { Subject, Topic, SrsCard, StudySession, Task } from '$lib/types';
import { defaultCard } from '$lib/srs';

type Mode = 'guest' | 'authenticated';

function lsGet<T>(key: string): T[] {
  if (!browser) return [];
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; }
  catch { return []; }
}

function lsSet<T>(key: string, data: T[]): void {
  if (browser) localStorage.setItem(key, JSON.stringify(data));
}

function newId(): string {
  return crypto.randomUUID();
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Convert legacy string[] from onboarding into Subject[] and persist */
function seedSubjectsFromNames(names: string[]): Subject[] {
  const result: Subject[] = names.map((name, i) => {
    const template = TCAS_SUBJECTS.find(s => s.name === name);
    return {
      id: newId(),
      userId: 'guest',
      name,
      symbol: template?.symbol ?? name.slice(0, 2),
      color: template?.color ?? '#6366f1',
      colorRgb: template?.colorRgb ?? '99,102,241',
      orderIndex: template?.orderIndex ?? i,
    };
  });
  lsSet('pulse_subjects', result);
  return result;
}

function mapSubjectFromDb(row: Record<string, unknown>): Subject {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    symbol: row.symbol as string,
    color: row.color as string,
    colorRgb: row.color_rgb as string,
    orderIndex: row.order_index as number,
    targetScore: row.target_score as number | undefined,
  };
}

function mapTopicFromDb(row: Record<string, unknown>): Topic {
  return {
    id: row.id as string,
    subjectId: row.subject_id as string,
    name: row.name as string,
    orderIndex: row.order_index as number,
  };
}

function mapCardFromDb(row: Record<string, unknown>): SrsCard {
  return {
    id: row.id as string,
    topicId: row.topic_id as string,
    userId: row.user_id as string,
    ease: row.ease as number,
    intervalDays: row.interval_days as number,
    dueDate: (row.due_date as string).split('T')[0],
    reps: row.reps as number,
  };
}

function mapSessionFromDb(row: Record<string, unknown>): StudySession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subjectId: row.subject_id as string,
    topicId: row.topic_id as string | undefined,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string,
    durationSec: row.duration_sec as number,
    mode: row.mode as StudySession['mode'],
  };
}

function mapTaskFromDb(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subjectId: row.subject_id as string | undefined,
    title: row.title as string,
    priority: row.priority as Task['priority'],
    dueDate: row.due_date as string | undefined,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string,
  };
}

export const db = {
  // ── SUBJECTS ──────────────────────────────────────────────
  async getSubjects(userId: string, mode: Mode): Promise<Subject[]> {
    if (mode === 'guest') {
      const raw = lsGet<Subject | string>('pulse_subjects');
      if (raw.length === 0) return [];
      if (typeof raw[0] === 'string') return seedSubjectsFromNames(raw as string[]);
      return raw as Subject[];
    }
    const { data } = await supabase.from('subjects').select('*').eq('user_id', userId).order('order_index');
    return (data ?? []).map(mapSubjectFromDb);
  },

  async saveSubject(subject: Subject, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<Subject>('pulse_subjects');
      const idx = all.findIndex(s => s.id === subject.id);
      if (idx >= 0) all[idx] = subject; else all.push(subject);
      lsSet('pulse_subjects', all);
      return;
    }
    await supabase.from('subjects').upsert({
      id: subject.id, user_id: subject.userId, name: subject.name,
      symbol: subject.symbol, color: subject.color, color_rgb: subject.colorRgb,
      order_index: subject.orderIndex, target_score: subject.targetScore ?? null,
    });
  },

  // ── TOPICS ────────────────────────────────────────────────
  async getTopics(userId: string, mode: Mode): Promise<Topic[]> {
    if (mode === 'guest') return lsGet<Topic>('pulse_topics');
    const { data } = await supabase.from('topics').select('*').eq('user_id', userId).order('order_index');
    return (data ?? []).map(mapTopicFromDb);
  },

  async saveTopic(topic: Topic, userId: string, mode: Mode): Promise<SrsCard> {
    if (mode === 'guest') {
      const all = lsGet<Topic>('pulse_topics');
      const idx = all.findIndex(t => t.id === topic.id);
      if (idx >= 0) all[idx] = topic; else all.push(topic);
      lsSet('pulse_topics', all);
      const card: SrsCard = { id: newId(), topicId: topic.id, userId, ...defaultCard() };
      const cards = lsGet<SrsCard>('pulse_srs_cards');
      if (!cards.find(c => c.topicId === topic.id)) {
        cards.push(card);
        lsSet('pulse_srs_cards', cards);
      }
      return card;
    }
    await supabase.from('topics').upsert({
      id: topic.id, subject_id: topic.subjectId,
      user_id: userId, name: topic.name, order_index: topic.orderIndex,
    });
    const cardId = newId();
    await supabase.from('srs_cards').upsert({
      id: cardId, topic_id: topic.id, user_id: userId,
      ease: 2.5, interval_days: 1, due_date: today(), reps: 0,
    });
    return { id: cardId, topicId: topic.id, userId, ...defaultCard() };
  },

  async deleteTopic(topicId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_topics', lsGet<Topic>('pulse_topics').filter(t => t.id !== topicId));
      lsSet('pulse_srs_cards', lsGet<SrsCard>('pulse_srs_cards').filter(c => c.topicId !== topicId));
      return;
    }
    await supabase.from('topics').delete().eq('id', topicId);
  },

  // ── SRS CARDS ─────────────────────────────────────────────
  async getSrsCards(userId: string, mode: Mode): Promise<SrsCard[]> {
    if (mode === 'guest') return lsGet<SrsCard>('pulse_srs_cards');
    const { data } = await supabase.from('srs_cards').select('*').eq('user_id', userId);
    return (data ?? []).map(mapCardFromDb);
  },

  async updateSrsCard(card: SrsCard, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<SrsCard>('pulse_srs_cards');
      const idx = all.findIndex(c => c.id === card.id);
      if (idx >= 0) all[idx] = card;
      lsSet('pulse_srs_cards', all);
      return;
    }
    await supabase.from('srs_cards').update({
      ease: card.ease, interval_days: card.intervalDays,
      due_date: card.dueDate, reps: card.reps, updated_at: new Date().toISOString(),
    }).eq('id', card.id);
  },

  // ── SESSIONS ──────────────────────────────────────────────
  async getSessions(userId: string, mode: Mode): Promise<StudySession[]> {
    if (mode === 'guest') return lsGet<StudySession>('pulse_sessions');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const { data } = await supabase.from('study_sessions').select('*')
      .eq('user_id', userId)
      .gte('started_at', cutoff.toISOString())
      .order('started_at', { ascending: false });
    return (data ?? []).map(mapSessionFromDb);
  },

  async logSession(session: StudySession, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<StudySession>('pulse_sessions');
      all.unshift(session);
      lsSet('pulse_sessions', all);
      return;
    }
    await supabase.from('study_sessions').insert({
      id: session.id, user_id: session.userId, subject_id: session.subjectId,
      topic_id: session.topicId ?? null, started_at: session.startedAt,
      ended_at: session.endedAt, duration_sec: session.durationSec, mode: session.mode,
    });
  },

  // ── TASKS ─────────────────────────────────────────────────
  async getTasks(userId: string, mode: Mode): Promise<Task[]> {
    if (mode === 'guest') return lsGet<Task>('pulse_tasks');
    const { data } = await supabase.from('tasks').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(mapTaskFromDb);
  },

  async saveTask(task: Task, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<Task>('pulse_tasks');
      const idx = all.findIndex(t => t.id === task.id);
      if (idx >= 0) all[idx] = task; else all.unshift(task);
      lsSet('pulse_tasks', all);
      return;
    }
    await supabase.from('tasks').upsert({
      id: task.id,
      user_id: task.userId,
      subject_id: task.subjectId ?? null,
      title: task.title,
      priority: task.priority,
      due_date: task.dueDate ?? null,
      completed_at: task.completedAt ?? null,
      created_at: task.createdAt,
    });
  },

  async deleteTask(taskId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_tasks', lsGet<Task>('pulse_tasks').filter(t => t.id !== taskId));
      return;
    }
    await supabase.from('tasks').delete().eq('id', taskId);
  },

  newId,
};
