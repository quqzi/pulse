import { describe, it, expect } from 'vitest';
import { snap, toLocalISO, dayIndexFrom } from './grid-math';

describe('grid math', () => {
  it('snap rounds to the 15-minute grid', () => {
    expect(snap(547)).toBe(540);
    expect(snap(553)).toBe(555);
    expect(snap(0)).toBe(0);
    expect(snap(1440)).toBe(1440);
  });

  it('toLocalISO renders local date+time without timezone conversion', () => {
    const day = new Date('2026-06-14T00:00:00');
    expect(toLocalISO(day, 23 * 60)).toBe('2026-06-14T23:00:00');
    expect(toLocalISO(day, 9 * 60 + 30)).toBe('2026-06-14T09:30:00');
  });

  it('toLocalISO clamps to the day and rolls midnight to the next date', () => {
    const day = new Date('2026-06-14T00:00:00');
    expect(toLocalISO(day, 25 * 60)).toBe('2026-06-15T00:00:00'); // clamped to 24:00
    expect(toLocalISO(day, -30)).toBe('2026-06-14T00:00:00');
  });

  it('dayIndexFrom counts days from the week start regardless of time of day', () => {
    const weekStart = new Date('2026-06-08T00:00:00'); // Monday
    expect(dayIndexFrom(weekStart, new Date('2026-06-08T10:00:00'))).toBe(0);
    expect(dayIndexFrom(weekStart, new Date('2026-06-14T23:59:00'))).toBe(6);
    expect(dayIndexFrom(weekStart, new Date('2026-06-07T12:00:00'))).toBe(-1);
  });
});
