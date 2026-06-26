import { describe, it, expect } from 'vitest';
import { scoreFromRow, scoreToRow, topicFromRow, topicToRow, flashcardFromRow, flashcardToRow, noteFromRow, noteToRow } from '$lib/data/mappers';
import type { MockScore, Topic, Flashcard, Note } from '$lib/types';

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

describe('note mapper', () => {
  it('round-trips a fully-populated note', () => {
    const n: Note = {
      id: 'n1', userId: 'u', subjectId: 'sub1', title: 'Kinematics',
      body: '# v = u + at', tags: ['physics', 'mechanics'], pinned: true,
      createdAt: '2026-06-26T10:00:00.000Z', updatedAt: '2026-06-26T11:00:00.000Z',
    };
    const row = noteToRow(n);
    expect(row.user_id).toBe('u');
    expect(row.subject_id).toBe('sub1');
    expect(row.tags).toEqual(['physics', 'mechanics']);
    expect(row.pinned).toBe(true);
    expect(noteFromRow(row)).toEqual(n);
  });

  it('maps an unfiled note: subjectId undefined <-> subject_id null', () => {
    const n: Note = {
      id: 'n2', userId: 'u', subjectId: undefined, title: '', body: '',
      tags: [], pinned: false,
      createdAt: '2026-06-26T10:00:00.000Z', updatedAt: '2026-06-26T10:00:00.000Z',
    };
    const row = noteToRow(n);
    expect(row.subject_id).toBe(null);
    expect(row.tags).toEqual([]);
    expect(noteFromRow(row)).toEqual(n);
  });

  it('defaults a row with null tags to an empty array', () => {
    const row = {
      id: 'n3', user_id: 'u', subject_id: null, title: 't', body: 'b',
      tags: null, pinned: false,
      created_at: '2026-06-26T10:00:00.000Z', updated_at: '2026-06-26T10:00:00.000Z',
    };
    expect(noteFromRow(row).tags).toEqual([]);
  });
});
