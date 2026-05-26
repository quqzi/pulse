import type { Subject, SrsCard, StudySession, Task, ScheduleSlot } from '$lib/types';
import type { Settings } from '$lib/stores/settings';

export interface SchedulerInput {
  weekStart: Date;
  subjects: Subject[];
  sessions: StudySession[];       // past 14 days (for deficit calc)
  srsCards: SrsCard[];
  tasks: Task[];
  existingSlots: ScheduleSlot[];  // confirmed slots already on calendar
  settings: Settings;
  examDate: string | null;        // ISO date "YYYY-MM-DD" or null
}

const SLOT_STEP = 30;   // minutes
const MIN_BLOCK = 30;   // minutes
const MAX_BLOCK = 90;   // minutes
const START_HOUR = 6;
const END_HOUR = 22;

// Parse "HH:MM" -> { h, m }
function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(Number);
  return { h, m };
}

// Format date as "YYYY-MM-DD"
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// Format date + hour/minute as local ISO "YYYY-MM-DDTHH:MM:SS"
function toLocalISO(date: Date, hour: number, minute: number): string {
  const dateStr = toDateStr(date);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${dateStr}T${hh}:${mm}:00`;
}

// Add minutes to a {hour, minute} pair, returns {hour, minute}
function addMinutes(hour: number, minute: number, mins: number): { hour: number; minute: number } {
  const total = hour * 60 + minute + mins;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

// Convert startTime/endTime strings to minute-offsets from midnight
function slotToMinutes(timeStr: string): { start: number; end: number } {
  // timeStr: "YYYY-MM-DDTHH:MM:SS"
  const timePart = timeStr.split('T')[1] ?? '00:00:00';
  const [h, m] = timePart.split(':').map(Number);
  return { start: h * 60 + m, end: h * 60 + m };
}

function timeStrToMinutes(timeStr: string): number {
  const timePart = timeStr.split('T')[1] ?? '00:00:00';
  const [h, m] = timePart.split(':').map(Number);
  return h * 60 + m;
}

// Get Mon=0 … Sun=6 from a Date
function getDow(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function genId(): string {
  return 'ai_' + Math.random().toString(36).slice(2, 11);
}

// ── Step 3: energy multiplier ──────────────────────────────────────────────
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
  // neutral
  return 1.0;
}

// ── Blocked-time map ───────────────────────────────────────────────────────
// For a given day, track blocked minute ranges as [start, end) pairs
type BlockedRange = { start: number; end: number };

function isMinuteBlocked(blocked: BlockedRange[], minute: number): boolean {
  return blocked.some(r => minute >= r.start && minute < r.end);
}

function blockRange(blocked: BlockedRange[], start: number, end: number): void {
  blocked.push({ start, end });
}

// Find contiguous free block starting at `fromMinute` up to `toMinute`
// Returns length in minutes (multiple of SLOT_STEP) or 0 if none
function freeBlockAt(
  blocked: BlockedRange[],
  fromMinute: number,
  toMinute: number
): number {
  let len = 0;
  let cur = fromMinute;
  while (cur < toMinute) {
    if (isMinuteBlocked(blocked, cur)) break;
    len += SLOT_STEP;
    cur += SLOT_STEP;
  }
  return len;
}

// Find the best (highest energy) free slot for a given day
function findBestSlot(
  blocked: BlockedRange[],
  dayDate: Date,
  profile: Settings['energyProfile'],
  neededMinutes: number
): { startMinute: number; durationMinutes: number } | null {
  const dayStart = START_HOUR * 60;
  const dayEnd = END_HOUR * 60;
  const duration = Math.min(MAX_BLOCK, neededMinutes);

  let bestStart = -1;
  let bestEnergy = -1;

  for (let m = dayStart; m + MIN_BLOCK <= dayEnd; m += SLOT_STEP) {
    if (isMinuteBlocked(blocked, m)) continue;
    // Check we have at least MIN_BLOCK free
    const free = freeBlockAt(blocked, m, Math.min(m + duration, dayEnd));
    if (free < MIN_BLOCK) continue;
    const hour = Math.floor(m / 60);
    const e = energyScore(hour, profile);
    if (e > bestEnergy) {
      bestEnergy = e;
      bestStart = m;
    }
  }

  if (bestStart === -1) return null;

  // Clamp duration to available free time
  const actualDuration = Math.min(
    duration,
    freeBlockAt(blocked, bestStart, Math.min(bestStart + duration, dayEnd))
  );
  if (actualDuration < MIN_BLOCK) return null;

  return { startMinute: bestStart, durationMinutes: actualDuration };
}

// ── Main export ────────────────────────────────────────────────────────────
export function generateSchedule(input: SchedulerInput): ScheduleSlot[] {
  const { weekStart, subjects, sessions, srsCards, tasks, existingSlots, settings, examDate } = input;

  // Build array of 7 day Dates: Mon … Sun
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // ── Step 1: Build blocked time maps ───────────────────────────────────────
  // Map from dateStr -> blocked ranges
  const blockedMap = new Map<string, BlockedRange[]>();
  for (const day of days) {
    blockedMap.set(toDateStr(day), []);
  }

  const schoolStart = parseHHMM(settings.schoolStart);
  const schoolEnd = parseHHMM(settings.schoolEnd);

  for (const day of days) {
    const dateStr = toDateStr(day);
    const blocked = blockedMap.get(dateStr)!;
    const dow = getDow(day); // Mon=0 … Sun=6
    const dowOneBased = dow + 1; // 1=Mon … 7=Sun

    // School hours
    if (settings.schoolHoursEnabled && settings.schoolDays.includes(dowOneBased)) {
      blockRange(
        blocked,
        schoolStart.h * 60 + schoolStart.m,
        schoolEnd.h * 60 + schoolEnd.m
      );
    }

    // Existing confirmed slots on this day
    for (const slot of existingSlots) {
      if (!slot.startTime.startsWith(dateStr)) continue;
      const startM = timeStrToMinutes(slot.startTime);
      const endM = timeStrToMinutes(slot.endTime) + settings.bufferMinutes;
      blockRange(blocked, startM, endM);
    }
  }

  // ── Step 2: Score subjects ─────────────────────────────────────────────────
  const weekStartStr = toDateStr(days[0]);
  const weekEndStr = toDateStr(days[6]);

  // Compute days to exam
  let daysToExam = Infinity;
  if (examDate) {
    const examMs = new Date(examDate).getTime();
    const nowMs = new Date(weekStartStr).getTime();
    daysToExam = Math.max(0, (examMs - nowMs) / (1000 * 60 * 60 * 24));
  }

  // Map topicId -> subjectId via SRS cards (for counting SRS per subject)
  // We need to know which subject each card belongs to via topic
  // Since Topic type isn't in input, we relate via srsCard.topicId and the session subjectId
  // For SRS counting per subject: we match srsCards.userId (not ideal) — instead we'll
  // need to rely on sessions or the topicId. Since we don't have topics in input,
  // we use a workaround: group srs cards by their topicId prefix won't work.
  // The algorithm says "srsOverdueCount" and "srsDueThisWeekCount" per subject.
  // Since we only have topicId on srsCards, and Topic isn't in input,
  // we approximate by matching sessions: build topicId -> subjectId from sessions.
  const topicToSubject = new Map<string, string>();
  for (const s of sessions) {
    if (s.topicId) topicToSubject.set(s.topicId, s.subjectId);
  }

  const todayStr = toDateStr(new Date());

  interface SubjectScore {
    subject: Subject;
    score: number;
    deficitMinutes: number;
  }

  const numSubjects = subjects.length || 1;
  const weeklyGoalPerSubject = (settings.dailyGoalHours * 7) / numSubjects; // hours per subject per week

  const scored: SubjectScore[] = subjects.map(subject => {
    // SRS counts
    let srsOverdueCount = 0;
    let srsDueThisWeekCount = 0;
    for (const card of srsCards) {
      const subjectId = topicToSubject.get(card.topicId);
      if (subjectId !== subject.id) continue;
      if (card.dueDate <= todayStr) {
        srsOverdueCount++;
      } else if (card.dueDate >= weekStartStr && card.dueDate <= weekEndStr) {
        srsDueThisWeekCount++;
      }
    }

    // Hours studied this week (from sessions in past 14 days that fall in this week)
    let hoursStudiedThisWeek = 0;
    for (const sess of sessions) {
      if (sess.subjectId !== subject.id) continue;
      const sessDate = sess.startedAt.slice(0, 10);
      if (sessDate >= weekStartStr && sessDate <= weekEndStr) {
        hoursStudiedThisWeek += sess.durationSec / 3600;
      }
    }

    const hoursDeficit = Math.max(0, weeklyGoalPerSubject - hoursStudiedThisWeek);
    const examBonus = daysToExam < 30 ? 2 : 0;

    const score =
      srsOverdueCount * 3 +
      srsDueThisWeekCount * 2 +
      hoursDeficit * 1.5 +
      examBonus;

    return {
      subject,
      score,
      deficitMinutes: Math.round(hoursDeficit * 60),
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // ── Step 5: Task deadline injection ───────────────────────────────────────
  const results: ScheduleSlot[] = [];
  const TASK_BLOCK = 45; // minutes

  for (const task of tasks) {
    if (task.completedAt) continue;
    if (!task.dueDate || !task.subjectId) continue;
    if (task.dueDate < weekStartStr || task.dueDate > weekEndStr) continue;

    // Find the day object matching dueDate
    const dueDayIndex = days.findIndex(d => toDateStr(d) === task.dueDate);
    if (dueDayIndex === -1) continue;

    // Try dueDate day first, then day before
    const candidates = [dueDayIndex];
    if (dueDayIndex > 0) candidates.push(dueDayIndex - 1);

    let injected = false;
    for (const dayIdx of candidates) {
      if (injected) break;
      const day = days[dayIdx];
      const dateStr = toDateStr(day);
      const blocked = blockedMap.get(dateStr)!;

      const slot = findBestSlot(blocked, day, settings.energyProfile, TASK_BLOCK);
      if (!slot) continue;

      const { startMinute, durationMinutes } = slot;
      if (durationMinutes < MIN_BLOCK) continue;

      const actualDuration = Math.min(TASK_BLOCK, durationMinutes);
      const startHour = Math.floor(startMinute / 60);
      const startMin = startMinute % 60;
      const end = addMinutes(startHour, startMin, actualDuration);

      results.push({
        id: genId(),
        userId: '',
        subjectId: task.subjectId,
        topicId: undefined,
        startTime: toLocalISO(day, startHour, startMin),
        endTime: toLocalISO(day, end.hour, end.minute),
        isAiSuggested: true,
        isConfirmed: false,
        isFocusBlock: false,
        isRecurring: false,
        recurrenceDays: [],
        createdAt: new Date().toISOString(),
      });

      blockRange(
        blocked,
        startMinute,
        startMinute + actualDuration + settings.bufferMinutes
      );

      injected = true;
    }
  }

  // ── Step 4: Greedy fill ────────────────────────────────────────────────────

  // Track total minutes scheduled per day to enforce daily goal
  const dailyGoalMinutes = settings.dailyGoalHours * 60;
  const scheduledPerDay = new Map<string, number>();
  for (const day of days) scheduledPerDay.set(toDateStr(day), 0);

  for (const { subject, deficitMinutes } of scored) {
    if (deficitMinutes <= 0) continue;

    let minutesLeft = deficitMinutes;

    for (const day of days) {
      if (minutesLeft <= 0) break;

      const dateStr = toDateStr(day);
      const dayScheduled = scheduledPerDay.get(dateStr)!;
      if (dayScheduled >= dailyGoalMinutes) continue;

      const blocked = blockedMap.get(dateStr)!;
      const slot = findBestSlot(blocked, day, settings.energyProfile, minutesLeft);
      if (!slot) continue;

      const { startMinute, durationMinutes } = slot;
      const startHour = Math.floor(startMinute / 60);
      const startMin = startMinute % 60;
      const end = addMinutes(startHour, startMin, durationMinutes);

      const startTime = toLocalISO(day, startHour, startMin);
      const endTime = toLocalISO(day, end.hour, end.minute);

      results.push({
        id: genId(),
        userId: '',
        subjectId: subject.id,
        topicId: undefined,
        startTime,
        endTime,
        isAiSuggested: true,
        isConfirmed: false,
        isFocusBlock: false,
        isRecurring: false,
        recurrenceDays: [],
        createdAt: new Date().toISOString(),
      });

      // Block the used time + buffer
      blockRange(
        blocked,
        startMinute,
        startMinute + durationMinutes + settings.bufferMinutes
      );

      scheduledPerDay.set(dateStr, dayScheduled + durationMinutes);
      minutesLeft -= durationMinutes;
    }
  }

  return results;
}
