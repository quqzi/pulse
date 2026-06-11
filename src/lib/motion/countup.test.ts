import { describe, it, expect } from 'vitest';
import { countupFrames } from './countup';

describe('countupFrames', () => {
  it('starts at 0 and ends exactly at the target', () => {
    const frames = countupFrames(43, 5);
    expect(frames[0]).toBe(0);
    expect(frames[frames.length - 1]).toBe(43);
  });
  it('is monotonically non-decreasing with ease-out spacing', () => {
    const frames = countupFrames(100, 10);
    for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
    // ease-out: the first step covers more ground than the last
    expect(frames[1] - frames[0]).toBeGreaterThan(frames[frames.length - 1] - frames[frames.length - 2]);
  });
  it('handles decimals to one place', () => {
    const frames = countupFrames(3.7, 4, 1);
    expect(frames[frames.length - 1]).toBe(3.7);
  });
});
