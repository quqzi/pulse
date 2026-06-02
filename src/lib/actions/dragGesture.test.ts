import { describe, it, expect } from 'vitest';
import { createGesture, moveGesture } from './dragGesture';

describe('dragGesture', () => {
  it('does not start until movement passes the threshold (mouse)', () => {
    let s = createGesture({ x: 100, y: 100 }, false);
    const r1 = moveGesture(s, { x: 102, y: 101 }, { threshold: 4 });
    expect(r1.emit).toBe(null);
    expect(r1.state.started).toBe(false);
  });

  it('starts when movement passes the threshold, then moves', () => {
    let s = createGesture({ x: 100, y: 100 }, false);
    const r1 = moveGesture(s, { x: 100, y: 110 }, { threshold: 4 });
    expect(r1.emit).toBe('start');
    expect(r1.dy).toBe(10);
    const r2 = moveGesture(r1.state, { x: 100, y: 130 }, { threshold: 4 });
    expect(r2.emit).toBe('move');
    expect(r2.dy).toBe(30);
  });

  it('starts immediately when already grabbed (touch long-press), even with no movement', () => {
    let s = createGesture({ x: 100, y: 100 }, true);
    const r1 = moveGesture(s, { x: 100, y: 100 }, { threshold: 4 });
    expect(r1.emit).toBe('start');
  });
});
