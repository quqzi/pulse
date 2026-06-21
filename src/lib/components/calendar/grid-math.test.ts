import { describe, it, expect } from 'vitest';
import { snap, toLocalISO, dayIndexFrom, packSlots } from './grid-math';

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

describe('packSlots', () => {
  it('single slot gets col=0, total=1', () => {
    const result = packSlots([{ id: 'a', startMin: 60, endMin: 120 }]);
    expect(result.get('a')).toEqual({ col: 0, total: 1 });
  });

  it('non-overlapping slots each get col=0, total=1', () => {
    const result = packSlots([
      { id: 'a', startMin: 60, endMin: 120 },
      { id: 'b', startMin: 120, endMin: 180 },
    ]);
    expect(result.get('a')).toEqual({ col: 0, total: 1 });
    expect(result.get('b')).toEqual({ col: 0, total: 1 });
  });

  it('two fully overlapping slots split into 2 columns', () => {
    const result = packSlots([
      { id: 'a', startMin: 60, endMin: 120 },
      { id: 'b', startMin: 60, endMin: 120 },
    ]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    expect(a.total).toBe(2);
    expect(b.total).toBe(2);
    expect(new Set([a.col, b.col])).toEqual(new Set([0, 1]));
  });

  it('three fully overlapping slots split into 3 columns', () => {
    const result = packSlots([
      { id: 'a', startMin: 60, endMin: 180 },
      { id: 'b', startMin: 60, endMin: 180 },
      { id: 'c', startMin: 60, endMin: 180 },
    ]);
    expect(result.get('a')!.total).toBe(3);
    expect(result.get('b')!.total).toBe(3);
    expect(result.get('c')!.total).toBe(3);
    const cols = [result.get('a')!.col, result.get('b')!.col, result.get('c')!.col];
    expect(new Set(cols)).toEqual(new Set([0, 1, 2]));
  });

  it('partially overlapping cascade: a|b overlap, b|c overlap but a|c do not share a cluster', () => {
    // a: 60-120, b: 90-150, c: 130-180 => a+b overlap, b+c overlap → one cluster of 3
    const result = packSlots([
      { id: 'a', startMin: 60, endMin: 120 },
      { id: 'b', startMin: 90, endMin: 150 },
      { id: 'c', startMin: 130, endMin: 180 },
    ]);
    // All three in one cluster (clusterEnd extends through c)
    const a = result.get('a')!;
    const b = result.get('b')!;
    const c = result.get('c')!;
    expect(a.total).toBe(b.total);
    // a and b must be in different columns
    expect(a.col).not.toBe(b.col);
    // c can reuse a's column since c.startMin(130) >= a.endMin(120)
    expect(c.col).toBe(a.col);
  });

  it('empty array returns empty map', () => {
    expect(packSlots([])).toEqual(new Map());
  });
});
