import { describe, it, expect } from 'vitest';
import { scoreFromRow, scoreToRow, topicFromRow, topicToRow, flashcardFromRow, flashcardToRow } from '$lib/data/mappers';
import type { MockScore, Topic, Flashcard } from '$lib/types';

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

  it('round-trips next_study_date', () => {
    const t: Topic = { id: 't1', subjectId: 's1', name: 'K', orderIndex: 0, nextStudyDate: '2026-06-14' };
    expect(topicToRow(t).next_study_date).toBe('2026-06-14');
    expect(topicFromRow(topicToRow(t)).nextStudyDate).toBe('2026-06-14');
  });

  it('legacy row → nextStudyDate undefined', () => {
    expect(topicFromRow({ id: 't', subject_id: 's', name: 'n', order_index: 0 }).nextStudyDate).toBeUndefined();
  });
});

describe('flashcard mapper', () => {
  it('round-trips a flashcard', () => {
    const f: Flashcard = { id: 'f1', userId: 'u', topicId: 't1', front: 'v=?', back: 'u+at', createdAt: '2026-06-07T00:00:00Z' };
    const row = flashcardToRow(f);
    expect(row.user_id).toBe('u');
    expect(row.topic_id).toBe('t1');
    expect(flashcardFromRow(row)).toEqual(f);
  });
});
