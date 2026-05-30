import { get } from 'svelte/store';
import type { Task, MockScore, Template, Subject } from '$lib/types';
import { tasks, scores, templates, subjects, topics, srsCards } from '$lib/data/stores';
import { repo } from '$lib/data/repository';
import { taskFromRow, taskToRow, scoreFromRow, scoreToRow, templateFromRow, templateToRow, subjectFromRow, subjectToRow } from '$lib/data/mappers';
import { getAuthContext } from '$lib/data/authctx';
import { toast } from '$lib/stores/toast';
import { lsWrite } from '$lib/data/ls';
import { supabase } from '$lib/supabase';

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
  ...subjectsBase,
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
    const removedTopicIds = new Set(snapTop.filter(t => t.subjectId === id).map(t => t.id));

    subjects.set(snapSub.filter(s => s.id !== id));
    topics.set(snapTop.filter(t => t.subjectId !== id));
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
      toast.error("Couldn't delete — try again");
    }
  },
};
