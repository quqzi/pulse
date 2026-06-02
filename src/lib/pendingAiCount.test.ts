import { describe, it, expect } from 'vitest';
import { pendingAiCount } from './pendingAiCount';
import type { ScheduleSlot } from './types';

function slot(p: Partial<ScheduleSlot>): ScheduleSlot {
  return {
    id: 'x', userId: 'guest',
    startTime: '2026-06-04T09:00:00', endTime: '2026-06-04T10:00:00',
    subjectId: undefined, topicId: undefined,
    isAiSuggested: false, isConfirmed: false, isFocusBlock: false,
    isRecurring: false, recurrenceDays: [], createdAt: '2026-06-04T00:00:00',
    ...p,
  };
}

describe('pendingAiCount', () => {
  it('counts only AI-suggested slots', () => {
    const slots = [slot({ isAiSuggested: true }), slot({ isAiSuggested: false }), slot({ isAiSuggested: true })];
    expect(pendingAiCount(slots)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(pendingAiCount([])).toBe(0);
  });

  it('excludes AI slots already confirmed', () => {
    const slots = [slot({ isAiSuggested: true }), slot({ isAiSuggested: true, isConfirmed: true })];
    expect(pendingAiCount(slots)).toBe(1);
  });
});
