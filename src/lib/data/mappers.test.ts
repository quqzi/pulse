import { describe, it, expect } from 'vitest';
import { scoreFromRow, scoreToRow, topicFromRow, topicToRow } from '$lib/data/mappers';
import type { MockScore, Topic } from '$lib/types';

describe('score mapper', () => {
  it('round-trips camel <-> snake', () => {
    const s: MockScore = {
      id: '1', userId: 'u', subjectId: 'sub', score: 42, maxScore: 60,
      takenAt: '2026-05-30', notes: undefined, createdAt: '2026-05-30T10:00:00Z',
    };
    const row = scoreToRow(s);
    expect(row.user_id).toBe('u');
    expect(row.max_score).toBe(60);
    expect(row.notes).toBe(null);
    expect(scoreFromRow(row)).toEqual(s);
  });
});

describe('topic mapper', () => {
  it('round-trips done and note', () => {
    const t: Topic = { id: 't1', subjectId: 's1', name: 'Kinematics', orderIndex: 0, done: true, note: 'watch units' };
    const row = topicToRow(t);
    expect(row.done).toBe(true);
    expect(row.note).toBe('watch units');
    expect(topicFromRow(row)).toEqual(t);
  });

  it('defaults a legacy row with no done/note columns', () => {
    const row = { id: 't1', subject_id: 's1', name: 'Kinematics', order_index: 0 };
    expect(topicFromRow(row)).toEqual({ id: 't1', subjectId: 's1', name: 'Kinematics', orderIndex: 0, done: false, note: undefined });
  });

  it('toRow emits done:false and note:null when absent', () => {
    const t: Topic = { id: 't1', subjectId: 's1', name: 'Kinematics', orderIndex: 0 };
    const row = topicToRow(t);
    expect(row.done).toBe(false);
    expect(row.note).toBe(null);
  });
});
