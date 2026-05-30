import { describe, it, expect } from 'vitest';
import { scoreFromRow, scoreToRow } from '$lib/data/mappers';
import type { MockScore } from '$lib/types';

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
