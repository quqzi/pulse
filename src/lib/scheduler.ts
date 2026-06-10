import type { Subject, Topic, SrsCard, StudySession, Task, ScheduleSlot } from '$lib/types';
import type { Settings } from '$lib/stores/settings';
import { localDateStr } from '$lib/utils';

export interface SchedulerInput {
  weekStart: Date;
  subjects: Subject[];
  topics: Topic[];
  sessions: StudySession[];       // past 14 days (for deficit calc)
  srsCards: SrsCard[];
  tasks: Task[];
  existingSlots: ScheduleSlot[];  // confirmed slots already on calendar
  settings: Settings;
  examDate: string | null;        // ISO date "YYYY-MM-DD" or null
}

export function generateSchedule(input: SchedulerInput): ScheduleSlot[] {
  const { weekStart, subjects, topics, sessions, srsCards, tasks, existingSlots, settings, examDate } = input;
  const results: ScheduleSlot[] = [];

  // Build week days (Mon–Sun)
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // ── Step 1: Build blocked intervals per day ────────────────────
  const blockedByDay: Array<Array<{ start: number; end: number }>> = weekDays.map((day) => {
    const blocked: Array<{ start: number; end: number }> = [];

    if (settings.schoolHoursEnabled) {
      const dow = (day.getDay() + 6) % 7; // Mon=0
      if (settings.schoolDays.includes(dow + 1)) {
        const [sh, sm] = settings.schoolStart.split(':').map(Number);
        const [eh, em] = settings.schoolEnd.split(':').map(Number);
        blocked.push({ start: sh * 60 + sm, end: eh * 60 + em });
      }
    }

    for (const slot of existingSlots) {
      if (!slot.isConfirmed) continue;
      const slotDay = new Date(slot.startTime);
      slotDay.setHours(0, 0, 0, 0);
      if (slotDay.getTime() !== day.getTime()) continue;
      const s = new Date(slot.startTime);
      const e = new Date(slot.endTime);
      blocked.push({
        start: s.getHours() * 60 + s.getMinutes(),
        end: e.getHours() * 60 + e.getMinutes() + settings.bufferMinutes,
      });
    }

    return blocked;
  });

  // ── Step 2: Score subjects ─────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);
  const weekEndStr = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return localDateStr(d);
  })();
  const daysToExam = examDate
    ? Math.round((new Date(examDate).getTime() - today.getTime()) / 86400000)
    : Infinity;

  const cardSubjectId = new Map(topics.map(t => [t.id, t.subjectId]));

  const subjectScores = subjects.map(subject => {
    const cards = srsCards.filter(c => cardSubjectId.get(c.topicId) === subject.id);
    const overdueCount = cards.filter(c => c.dueDate < todayStr).length;
    const dueThisWeekCount = cards.filter(c => c.dueDate >= todayStr && c.dueDate < weekEndStr).length;

    const hoursThisWeek = sessions
      .filter(s => s.subjectId === subject.id && new Date(s.startedAt) >= weekStart)
      .reduce((sum, s) => sum + s.durationSec / 3600, 0);

    const weeklyGoalPerSubject = (subjects.length > 0)
      ? settings.dailyGoalHours * 7 / subjects.length
      : settings.dailyGoalHours;
    const hoursDeficit = Math.max(0, weeklyGoalPerSubject - hoursThisWeek);

    const score =
      overdueCount * 3
      + dueThisWeekCount * 2
      + hoursDeficit * 1.5
      + (daysToExam < 30 ? 2 : 0);

    return { subject, score, hoursDeficit };
  });

  subjectScores.sort((a, b) => b.score - a.score);

  // ── Step 3: Energy multiplier ──────────────────────────────────
  function energyScore(hour: number, profile: Settings['energyProfile']): number {
    if (profile === 'morning') {
      if (hour >= 6 && hour < 12) return 1.5;
      if (hour >= 14 && hour < 17) return 0.6;
      return 1.0;
    }
    if (profile === 'evening') {
      if (hour >= 18 && hour < 22) return 1.5;
      if (hour >= 10 && hour < 13) return 0.6;
      return 1.0;
    }
    return 1.0;
  }

  // ── Step 4: Greedy fill ────────────────────────────────────────
  const SLOT_STEP = 30;
  const MIN_BLOCK = 30;
  const MAX_BLOCK = 90;
  const TASK_BLOCK = 45;
  const START_HOUR = 6;
  const END_HOUR = 22;

  function isAvailable(dayIdx: number, startMin: number, endMin: number): boolean {
    for (const b of blockedByDay[dayIdx]) {
      if (startMin < b.end && endMin > b.start) return false;
    }
    return true;
  }

  function blockDay(dayIdx: number, startMin: number, endMin: number) {
    blockedByDay[dayIdx].push({
      start: startMin,
      end: endMin + settings.bufferMinutes,
    });
  }

  function makeId(): string {
    return 'ai_' + Math.random().toString(36).slice(2, 11);
  }

  function toISO(day: Date, minutes: number): string {
    const d = new Date(day);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  const dailyGoalMinutes = settings.dailyGoalHours * 60;
  const dailyPlanned = new Array(7).fill(0);

  for (const slot of existingSlots) {
    if (!slot.isConfirmed) continue;
    const slotDay = new Date(slot.startTime);
    slotDay.setHours(0, 0, 0, 0);
    const dayIdx = Math.round((slotDay.getTime() - weekStart.getTime()) / 86400000);
    if (dayIdx < 0 || dayIdx >= 7) continue;
    const dur = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000;
    dailyPlanned[dayIdx] += dur;
  }

  for (const { subject, hoursDeficit } of subjectScores) {
    if (hoursDeficit <= 0) continue;
    let minutesLeft = Math.min(MAX_BLOCK * 2, Math.round(hoursDeficit * 60));

    for (let dayIdx = 0; dayIdx < 7 && minutesLeft > 0; dayIdx++) {
      if (dailyPlanned[dayIdx] >= dailyGoalMinutes) continue;

      let bestStart = -1;
      let bestScore = -Infinity;

      for (let m = START_HOUR * 60; m + MIN_BLOCK <= END_HOUR * 60; m += SLOT_STEP) {
        const blockLen = Math.min(MAX_BLOCK, minutesLeft, Math.floor((END_HOUR * 60 - m) / SLOT_STEP) * SLOT_STEP);
        if (blockLen < MIN_BLOCK) continue;
        if (!isAvailable(dayIdx, m, m + blockLen)) continue;

        const hour = Math.floor(m / 60);
        const s = energyScore(hour, settings.energyProfile);
        if (s > bestScore) {
          bestScore = s;
          bestStart = m;
        }
      }

      if (bestStart < 0) continue;

      const blockLen = Math.min(
        MAX_BLOCK,
        minutesLeft,
        Math.floor((END_HOUR * 60 - bestStart) / SLOT_STEP) * SLOT_STEP
      );
      if (blockLen < MIN_BLOCK) continue;
      const day = weekDays[dayIdx];

      results.push({
        id: makeId(),
        userId: '',
        subjectId: subject.id,
        topicId: undefined,
        startTime: toISO(day, bestStart),
        endTime: toISO(day, bestStart + blockLen),
        isAiSuggested: true,
        isConfirmed: false,
        isFocusBlock: false,
        isRecurring: false,
        recurrenceDays: [],
        createdAt: new Date().toISOString(),
      });

      blockDay(dayIdx, bestStart, bestStart + blockLen);
      dailyPlanned[dayIdx] += blockLen;
      minutesLeft -= blockLen;
    }
  }

  // ── Step 5: Task deadline injection ───────────────────────────
  for (const task of tasks) {
    if (!task.dueDate || task.completedAt) continue;
    const subjectId = task.subjectId;
    if (!subjectId) continue;
    const due = new Date(task.dueDate + 'T00:00:00');
    due.setHours(0, 0, 0, 0);
    const dayIdx = Math.round((due.getTime() - weekStart.getTime()) / 86400000);

    let placed = false;
    for (const d of [dayIdx, dayIdx - 1]) {
      if (placed) break;
      if (d < 0 || d >= 7) continue;

      for (let m = START_HOUR * 60; m + TASK_BLOCK <= END_HOUR * 60; m += SLOT_STEP) {
        if (!isAvailable(d, m, m + TASK_BLOCK)) continue;
        results.push({
          id: makeId(),
          userId: '',
          subjectId,
          topicId: undefined,
          startTime: toISO(weekDays[d], m),
          endTime: toISO(weekDays[d], m + TASK_BLOCK),
          isAiSuggested: true,
          isConfirmed: false,
          isFocusBlock: false,
          isRecurring: false,
          recurrenceDays: [],
          createdAt: new Date().toISOString(),
        });
        blockDay(d, m, m + TASK_BLOCK);
        placed = true;
        break;
      }
    }
  }

  return results;
}
