import { describe, it, expect } from 'vitest';
import { subjectCoverage } from '$lib/data/readiness-util';

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
