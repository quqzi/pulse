import { describe, it, expect } from 'vitest';
import { mergeRemote, defaults } from '$lib/stores/settings';

describe('mergeRemote', () => {
  it('overlays remote fields onto defaults', () => {
    const merged = mergeRemote({ theme: 'apple-dark', dailyGoalHours: 6 });
    expect(merged.theme).toBe('apple-dark');
    expect(merged.dailyGoalHours).toBe(6);
    // untouched fields fall back to defaults
    expect(merged.pomodoroWork).toBe(defaults().pomodoroWork);
  });

  it('returns clean defaults for an empty/absent remote blob', () => {
    expect(mergeRemote({})).toEqual(defaults());
    expect(mergeRemote(null)).toEqual(defaults());
  });
});
