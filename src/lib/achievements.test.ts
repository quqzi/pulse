import { describe, it, expect } from 'vitest';
import { computeAchievements, ACHIEVEMENT_IDS, type AchievementInput } from './achievements';

const zero: AchievementInput = {
  sessionCount: 0, totalHours: 0, streak: 0, mockCount: 0,
  bestMockAccuracy: 0, cardCount: 0, tasksCompleted: 0,
};

describe('computeAchievements', () => {
  it('returns every badge, all locked at zero', () => {
    const all = computeAchievements(zero);
    expect(all.map(a => a.id)).toEqual(ACHIEVEMENT_IDS);
    expect(all.every(a => !a.unlocked && a.progress === 0)).toBe(true);
  });

  it('unlocks streak tiers cumulatively', () => {
    const all = computeAchievements({ ...zero, streak: 7 });
    const byId = Object.fromEntries(all.map(a => [a.id, a]));
    expect(byId.streak3.unlocked).toBe(true);
    expect(byId.streak7.unlocked).toBe(true);
    expect(byId.streak30.unlocked).toBe(false);
    expect(byId.streak30.progress).toBeCloseTo(7 / 30);
  });

  it('caps progress at 1 and floors displayed value', () => {
    const all = computeAchievements({ ...zero, totalHours: 99.7 });
    const h10 = all.find(a => a.id === 'hours10')!;
    expect(h10.progress).toBe(1);
    expect(h10.value).toBe(99);
  });

  it('mock90 keys off best accuracy, not count', () => {
    const all = computeAchievements({ ...zero, mockCount: 5, bestMockAccuracy: 88 });
    expect(all.find(a => a.id === 'mock90')!.unlocked).toBe(false);
    expect(all.find(a => a.id === 'firstMock')!.unlocked).toBe(true);
  });
});
