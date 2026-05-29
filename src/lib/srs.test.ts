import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reviewCard, defaultCard, isDue } from '$lib/srs';

// Fixed instant at noon UTC so the UTC date (used by toISOString) is stable
// regardless of the machine's timezone.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('reviewCard', () => {
  it('Again (1) resets interval to 1 and drops ease by 0.2', () => {
    const r = reviewCard(2.5, 10, 1);
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBeCloseTo(2.3);
    expect(r.dueDate).toBe('2026-01-16');
  });

  it('Hard (2) multiplies interval by 1.2 and drops ease by 0.15', () => {
    const r = reviewCard(2.5, 10, 2);
    expect(r.intervalDays).toBe(12); // round(10 * 1.2)
    expect(r.ease).toBeCloseTo(2.35);
    expect(r.dueDate).toBe('2026-01-27');
  });

  it('Good (3) multiplies interval by ease and leaves ease unchanged', () => {
    const r = reviewCard(2.5, 10, 3);
    expect(r.intervalDays).toBe(25); // round(10 * 2.5)
    expect(r.ease).toBeCloseTo(2.5);
    expect(r.dueDate).toBe('2026-02-09');
  });

  it('Easy (4) multiplies interval by ease*1.3 and raises ease by 0.1', () => {
    const r = reviewCard(2.0, 10, 4);
    expect(r.intervalDays).toBe(26); // round(10 * 2.0 * 1.3)
    expect(r.ease).toBeCloseTo(2.1);
    expect(r.dueDate).toBe('2026-02-10');
  });

  it('floors ease at 1.3 on repeated Again', () => {
    const r = reviewCard(1.3, 5, 1);
    expect(r.ease).toBeCloseTo(1.3);
    expect(r.intervalDays).toBe(1);
  });
});

describe('defaultCard', () => {
  it('returns a fresh card due today', () => {
    expect(defaultCard()).toEqual({
      ease: 2.5,
      intervalDays: 1,
      dueDate: '2026-01-15',
      reps: 0,
    });
  });
});

describe('isDue', () => {
  it('is true for past and today, false for future', () => {
    expect(isDue('2026-01-14')).toBe(true);
    expect(isDue('2026-01-15')).toBe(true);
    expect(isDue('2026-01-16')).toBe(false);
  });
});
