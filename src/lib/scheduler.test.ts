import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateSchedule, type SchedulerInput } from '$lib/scheduler';
import type { Settings } from '$lib/stores/settings';

// 2026-01-12 is a Monday. Parsed without 'Z' => local midnight, matching how the
// scheduler builds week days with local date methods.
const WEEK_START = new Date('2026-01-12T00:00:00');

function baseSettings(over: Partial<Settings> = {}): Settings {
  return {
    theme: 'vercel-light',
    lang: 'en',
    dailyGoalHours: 2,
    pomodoroWork: 25,
    pomodoroBreak: 5,
    schoolHoursEnabled: false,
    schoolDays: [1, 2, 3, 4, 5],
    schoolStart: '08:00',
    schoolEnd: '15:30',
    energyProfile: 'neutral',
    bufferMinutes: 10,
    examDate: null,
    ...over,
  };
}

function baseInput(over: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    weekStart: WEEK_START,
    subjects: [],
    topics: [],
    sessions: [],
    flashcards: [],
    tasks: [],
    existingSlots: [],
    settings: baseSettings(),
    examDate: null,
    ...over,
  };
}

// Minutes-from-midnight from a "YYYY-MM-DDTHH:MM:00" local-time string.
function startMin(iso: string): number {
  const [h, m] = iso.split('T')[1].split(':').map(Number);
  return h * 60 + m;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-12T08:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // deterministic ids
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('generateSchedule', () => {
  it('returns nothing when there are no subjects and no tasks', () => {
    expect(generateSchedule(baseInput())).toEqual([]);
  });

  it('fills the earliest available 06:00 block for a subject with a deficit', () => {
    const out = generateSchedule(baseInput({
      subjects: [{ id: 's1', userId: 'u', name: 'Physics', symbol: 'Ph', color: '#0d9488', colorRgb: '13,148,136', orderIndex: 0 }],
    }));
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(s => s.isAiSuggested && !s.isConfirmed && !s.isFocusBlock)).toBe(true);
    expect(out.every(s => s.subjectId === 's1')).toBe(true);
    expect(out.every(s => s.id.startsWith('ai_'))).toBe(true);
    expect(out[0].startTime).toBe('2026-01-12T06:00:00');
    expect(out[0].endTime).toBe('2026-01-12T07:30:00');
  });

  it('never schedules a suggested block overlapping school hours', () => {
    const out = generateSchedule(baseInput({
      subjects: [{ id: 's1', userId: 'u', name: 'Physics', symbol: 'Ph', color: '#0d9488', colorRgb: '13,148,136', orderIndex: 0 }],
      settings: baseSettings({ schoolHoursEnabled: true, schoolDays: [1], schoolStart: '08:00', schoolEnd: '15:30' }),
    }));
    const mondaySlots = out.filter(s => s.startTime.startsWith('2026-01-12'));
    for (const s of mondaySlots) {
      const start = startMin(s.startTime);
      const end = startMin(s.endTime);
      // must lie entirely before 08:00 (480) or after 15:30 (930)
      expect(end <= 480 || start >= 930).toBe(true);
    }
  });

  it('prioritizes the subject whose deck is overdue', () => {
    const out = generateSchedule(baseInput({
      subjects: [
        { id: 'sA', userId: 'u', name: 'Math', symbol: 'M', color: '#0d9488', colorRgb: '13,148,136', orderIndex: 0 },
        { id: 'sB', userId: 'u', name: 'Bio', symbol: 'B', color: '#7c3aed', colorRgb: '124,58,237', orderIndex: 1 },
      ],
      topics: [
        { id: 'tA', subjectId: 'sA', name: 'Algebra', orderIndex: 0, nextStudyDate: '2026-01-05' },
        { id: 'tB', subjectId: 'sB', name: 'Cells', orderIndex: 0 },
      ],
      flashcards: [
        { id: 'f1', userId: 'u', topicId: 'tA', front: 'q', back: 'a', createdAt: '2026-01-01T00:00:00Z' },
      ],
    }));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].subjectId).toBe('sA');
  });

  it('injects a 45-minute block on a task due date', () => {
    const out = generateSchedule(baseInput({
      tasks: [{
        id: 't1', userId: 'u', subjectId: 's1', title: 'Mock paper',
        priority: 'high', dueDate: '2026-01-14', createdAt: '2026-01-12T00:00:00.000Z',
      }],
    }));
    expect(out.length).toBe(1);
    expect(out[0].subjectId).toBe('s1');
    expect(out[0].startTime).toBe('2026-01-14T06:00:00');
    expect(out[0].endTime).toBe('2026-01-14T06:45:00');
    expect(out[0].isAiSuggested).toBe(true);
  });
});
