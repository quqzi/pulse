import { describe, it, expect } from 'vitest';
import { subjectCoverage, examAccuracy } from '$lib/data/readiness-util';

describe('subjectCoverage', () => {
  it('coverage = done / total', () => {
    expect(subjectCoverage([{ done: true }, { done: false }])).toBe(0.5);
    expect(subjectCoverage([{ done: true }, { done: true }])).toBe(1);
  });
  it('0 when no topics', () => {
    expect(subjectCoverage([])).toBe(0);
  });
  it('undefined done counts as not covered', () => {
    expect(subjectCoverage([{ done: undefined }, { done: true }])).toBe(0.5);
  });
});

describe('examAccuracy', () => {
  it('0 with no attempts', () => {
    expect(examAccuracy([])).toBe(0);
  });

  it('single attempt is its own ratio', () => {
    expect(examAccuracy([{ ratio: 0.6, date: '2026-06-01' }])).toBe(0.6);
  });

  it('recent improvement outweighs old bad attempts (old 40% + recent 80% → >70%)', () => {
    const old = ['2026-04-01', '2026-04-05', '2026-04-10', '2026-04-15', '2026-04-20']
      .map(date => ({ ratio: 0.4, date }));
    const recent = ['2026-06-01', '2026-06-10', '2026-06-20']
      .map(date => ({ ratio: 0.8, date }));
    const acc = examAccuracy([...old, ...recent]);
    expect(acc).toBeGreaterThan(0.7);
    // Flat all-time mean would be 0.55 — recency weighting must beat it.
    expect(acc).toBeGreaterThan(0.55);
  });

  it('only the last 5 attempts count', () => {
    const attempts = [
      { ratio: 0, date: '2026-01-01' }, // 6th newest → ignored
      { ratio: 1, date: '2026-02-01' },
      { ratio: 1, date: '2026-03-01' },
      { ratio: 1, date: '2026-04-01' },
      { ratio: 1, date: '2026-05-01' },
      { ratio: 1, date: '2026-06-01' },
    ];
    expect(examAccuracy(attempts)).toBe(1);
  });

  it('sorts by date, not input order', () => {
    const shuffled = [
      { ratio: 0.8, date: '2026-06-20' },
      { ratio: 0.4, date: '2026-01-01' },
      { ratio: 0.8, date: '2026-06-10' },
    ];
    // newest first: 0.8(w5) + 0.8(w4) + 0.4(w3) over weight 12 = 0.7
    expect(examAccuracy(shuffled)).toBeCloseTo(0.7, 5);
  });
});
