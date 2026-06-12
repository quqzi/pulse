import { describe, it, expect } from 'vitest';
import { nextDueDate } from './tasks';
import type { Task } from './types';

const base: Task = {
  id: 't1', userId: 'u1', title: 'x', priority: 'medium',
  createdAt: '2026-06-01T00:00:00Z',
};

const today = new Date('2026-06-13T10:00:00');

describe('nextDueDate', () => {
  it('daily task due today → tomorrow', () => {
    expect(nextDueDate({ ...base, repeat: 'daily', dueDate: '2026-06-13' }, today)).toBe('2026-06-14');
  });

  it('weekly task due today → next week', () => {
    expect(nextDueDate({ ...base, repeat: 'weekly', dueDate: '2026-06-13' }, today)).toBe('2026-06-20');
  });

  it('overdue daily task re-spawns from today, not from the stale due date', () => {
    expect(nextDueDate({ ...base, repeat: 'daily', dueDate: '2026-06-01' }, today)).toBe('2026-06-14');
  });

  it('future-dated weekly task steps from its own due date', () => {
    expect(nextDueDate({ ...base, repeat: 'weekly', dueDate: '2026-06-20' }, today)).toBe('2026-06-27');
  });

  it('no due date → steps from today', () => {
    expect(nextDueDate({ ...base, repeat: 'daily' }, today)).toBe('2026-06-14');
  });
});
