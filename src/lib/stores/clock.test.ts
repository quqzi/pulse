import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

describe('todayDate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); });

  it('emits the current local date string', async () => {
    vi.setSystemTime(new Date('2026-06-11T10:00:00'));
    const { todayDate } = await import('$lib/stores/clock');
    expect(get(todayDate)).toBe('2026-06-11');
  });

  it('ticks over at local midnight', async () => {
    vi.setSystemTime(new Date('2026-06-11T23:59:59'));
    const { todayDate } = await import('$lib/stores/clock');
    const seen: string[] = [];
    const unsub = todayDate.subscribe(v => seen.push(v));
    vi.advanceTimersByTime(2_000); // cross midnight
    unsub();
    expect(seen).toContain('2026-06-12');
  });
});
