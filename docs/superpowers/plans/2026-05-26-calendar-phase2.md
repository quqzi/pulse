# Calendar Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smart scheduling to the Phase 1 calendar — an Auto-schedule button that runs a pure algorithm and places ghosted AI-suggested blocks, school hours shading in the grid, per-day load bars, an exam countdown banner, and a right sidebar showing weekly stats + accept/reject controls.

**Design spec:** `docs/superpowers/specs/2026-05-25-calendar-design.md` (Phase 2 section)

**Branch:** `master`

**Tech Stack:** SvelteKit 2, TypeScript, plain CSS tokens, native JS Date (no date-fns)

---

## What Phase 1 Already Delivered (do not re-implement)

- `ScheduleSlot` type with `isAiSuggested` / `isConfirmed` fields
- CalBlock renders ghosted dashed state for `isAiSuggested: true`
- Per-block accept/dismiss popover in CalBlock + event handlers wired to page
- `db.confirmAllSuggested()` batch upsert method
- Settings fields: `schoolHoursEnabled`, `schoolDays`, `schoolStart`, `schoolEnd`, `energyProfile`, `bufferMinutes`
- `scheduleSlots` store + `loadScheduleSlots()`

---

## Tasks

### Task 1: Auto-Schedule Algorithm (`src/lib/scheduler.ts`)

**Files:**
- Create: `src/lib/scheduler.ts`

Pure function — no Svelte, no side effects, no imports from `$lib/stores`.

- [ ] **Step 1: Create `src/lib/scheduler.ts`**

```ts
import type { Subject, Topic, SrsCard, StudySession, Task, ScheduleSlot, Settings } from '$lib/types';

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

export function generateSchedule(input: SchedulerInput): ScheduleSlot[] {
  const { weekStart, subjects, sessions, srsCards, tasks, existingSlots, settings, examDate } = input;
  const results: ScheduleSlot[] = [];

  // Build week days (Mon–Sun)
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // ── Step 1: Build blocked intervals per day ────────────────────
  // Returns array of {start, end} in minutes-from-midnight for each day
  const blockedByDay: Array<Array<{ start: number; end: number }>> = weekDays.map((day, i) => {
    const blocked: Array<{ start: number; end: number }> = [];

    // School hours
    if (settings.schoolHoursEnabled) {
      const dow = (day.getDay() + 6) % 7; // Mon=0
      if (settings.schoolDays.includes(dow + 1)) { // settings uses 1=Mon
        const [sh, sm] = settings.schoolStart.split(':').map(Number);
        const [eh, em] = settings.schoolEnd.split(':').map(Number);
        blocked.push({ start: sh * 60 + sm, end: eh * 60 + em });
      }
    }

    // Existing confirmed slots
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
  const todayStr = today.toISOString().split('T')[0];
  const weekEndStr = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  })();
  const daysToExam = examDate
    ? Math.round((new Date(examDate).getTime() - today.getTime()) / 86400000)
    : Infinity;

  const subjectScores = subjects.map(subject => {
    const cards = srsCards.filter(c => c.subjectId === subject.id);
    const overdueCount = cards.filter(c => c.dueDate < todayStr).length;
    const dueThisWeekCount = cards.filter(c => c.dueDate >= todayStr && c.dueDate < weekEndStr).length;

    // Hours studied this week for this subject
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const hoursThisWeek = sessions
      .filter(s => s.subjectId === subject.id && s.startedAt >= weekStartStr + 'T00:00:00')
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
    return 1.0; // neutral
  }

  // ── Step 4: Greedy fill ────────────────────────────────────────
  const SLOT_STEP = 30;     // check every 30 min
  const MIN_BLOCK = 30;     // minimum block length placed
  const MAX_BLOCK = 90;     // maximum block length placed
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

  // Tally existing confirmed minutes per day
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

      // Find best slot for this subject on this day
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

      const blockLen = Math.min(MAX_BLOCK, minutesLeft);
      const day = weekDays[dayIdx];

      results.push({
        id: makeId(),
        userId: '',           // filled by caller
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
    const due = new Date(task.dueDate + 'T00:00:00');
    due.setHours(0, 0, 0, 0);
    const dayIdx = Math.round((due.getTime() - weekStart.getTime()) / 86400000);

    // Try due date, then day before
    for (const d of [dayIdx, dayIdx - 1]) {
      if (d < 0 || d >= 7) continue;
      const subjectId = task.subjectId;
      if (!subjectId) continue;

      // Find a 45-min slot
      for (let m = START_HOUR * 60; m + 45 <= END_HOUR * 60; m += SLOT_STEP) {
        if (!isAvailable(d, m, m + 45)) continue;
        results.push({
          id: makeId(),
          userId: '',
          subjectId,
          topicId: undefined,
          startTime: toISO(weekDays[d], m),
          endTime: toISO(weekDays[d], m + 45),
          isAiSuggested: true,
          isConfirmed: false,
          isFocusBlock: false,
          isRecurring: false,
          recurrenceDays: [],
          createdAt: new Date().toISOString(),
        });
        blockDay(d, m, m + 45);
        break;
      }
      break;
    }
  }

  return results;
}
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "feat(calendar): add pure auto-schedule algorithm (Phase 2)"
```

---

### Task 2: Load Bars + School Hours Shading in WeekGrid

**Files:**
- Modify: `src/lib/components/calendar/WeekGrid.svelte`

Add two visual features:
1. A 4px load bar per day column between the day header and all-day task row
2. A grey school-hours shaded region inside each day column

New props needed: `settings: Settings` (pass from page).

- [ ] **Step 1: Add `settings` prop and load bar computation**

At the top of the `<script>` block, add the import and prop:

```ts
import type { ScheduleSlot, Subject, Topic, Task, Settings } from '$lib/types';
export let settings: Settings | null = null;
```

Add a reactive declaration for planned minutes per day:

```ts
$: plannedMinutesByDay = (() => {
  const map = new Map<number, number>();
  for (let i = 0; i < 7; i++) map.set(i, 0);
  for (const slot of slots) {
    if (!slot.isConfirmed) continue;
    const idx = slotDayIdx(slot);
    if (idx < 0 || idx >= 7) continue;
    const dur = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000;
    map.set(idx, (map.get(idx) ?? 0) + dur);
  }
  return map;
})();

function loadBarColor(dayIdx: number): string {
  if (!settings) return 'var(--border)';
  const planned = plannedMinutesByDay.get(dayIdx) ?? 0;
  const goal = settings.dailyGoalHours * 60;
  const ratio = planned / goal;
  if (ratio >= 1.0) return '#ef4444';
  if (ratio >= 0.5) return 'var(--primary)';
  return 'var(--border)';
}

function loadBarWidth(dayIdx: number): number {
  if (!settings) return 0;
  const planned = plannedMinutesByDay.get(dayIdx) ?? 0;
  const goal = settings.dailyGoalHours * 60;
  return Math.min(100, (planned / goal) * 100);
}

function loadBarTooltip(dayIdx: number): string {
  const planned = plannedMinutesByDay.get(dayIdx) ?? 0;
  const h = Math.floor(planned / 60);
  const m = planned % 60;
  const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  const goal = settings ? `${settings.dailyGoalHours}h goal` : '';
  return `${label} planned · ${goal}`;
}
```

- [ ] **Step 2: Add school hours helper**

```ts
function schoolHoursBounds(dayIdx: number): { top: number; height: number } | null {
  if (!settings?.schoolHoursEnabled) return null;
  const day = weekDays[dayIdx];
  const dow = (day.getDay() + 6) % 7; // Mon=0
  if (!settings.schoolDays.includes(dow + 1)) return null; // settings uses 1=Mon
  const [sh, sm] = settings.schoolStart.split(':').map(Number);
  const [eh, em] = settings.schoolEnd.split(':').map(Number);
  const top = sh * 60 + sm - START_HOUR * 60;
  const height = (eh * 60 + em) - (sh * 60 + sm);
  if (top < 0 || height <= 0) return null;
  return { top, height };
}
```

- [ ] **Step 3: Add load bar row to HTML template**

Add a new `.load-bar-row` div between `.grid-header` and `.allday-row`:

```svelte
<!-- Load bar row -->
<div class="load-bar-row">
  <div class="time-gutter"></div>
  {#each weekDays as _day, i}
    <div class="load-bar-cell" title={loadBarTooltip(i)}>
      <div class="load-bar-fill" style="width: {loadBarWidth(i)}%; background: {loadBarColor(i)};"></div>
    </div>
  {/each}
</div>
```

- [ ] **Step 4: Add school hours shading inside each day column**

Inside the `{#each weekDays as day, i}` loop that renders day columns, add school shading just after the half-hour lines block:

```svelte
<!-- School hours shade -->
{@const school = schoolHoursBounds(i)}
{#if school}
  <div class="school-shade" style="top: {school.top}px; height: {school.height}px;"></div>
{/if}
```

- [ ] **Step 5: Add CSS**

Add to the `<style>` block:

```css
/* Load bar row */
.load-bar-row {
  display: grid;
  grid-template-columns: 44px repeat(7, 1fr);
  flex-shrink: 0;
  height: 6px;
  border-bottom: 1px solid var(--border);
}
.load-bar-cell {
  position: relative;
  border-left: 1px solid var(--border);
  background: var(--bg3);
  overflow: hidden;
}
.load-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  transition: width 0.3s ease;
}

/* School hours shade */
.school-shade {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(var(--primary-rgb), 0.04);
  border-top: 1px dashed var(--border);
  border-bottom: 1px dashed var(--border);
  pointer-events: none;
  z-index: 1;
}
```

- [ ] **Step 6: Verify**

Run: `npm run check`

Expected: No type errors (settings prop is optional, all accesses guarded with `?.`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/calendar/WeekGrid.svelte
git commit -m "feat(calendar): add load bars and school hours shading to WeekGrid"
```

---

### Task 3: Right Sidebar Component

**Files:**
- Create: `src/lib/components/calendar/ScheduleSidebar.svelte`

Shows weekly stats, per-subject bars, SRS due count, and accept/reject controls for AI suggestions.

- [ ] **Step 1: Create `src/lib/components/calendar/ScheduleSidebar.svelte`**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ScheduleSlot, Subject, SrsCard, StudySession, Settings } from '$lib/types';

  export let slots: ScheduleSlot[] = [];
  export let subjects: Subject[] = [];
  export let srsCards: SrsCard[] = [];
  export let sessions: StudySession[] = [];
  export let settings: Settings | null = null;
  export let weekStart: Date = new Date();

  const dispatch = createEventDispatcher<{
    acceptAll: void;
    rejectAll: void;
  }>();

  $: weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  })();

  $: weekStartStr = weekStart.toISOString().substring(0, 10);
  $: weekEndStr = weekEnd.toISOString().substring(0, 10);

  $: confirmedSlots = slots.filter(s => s.isConfirmed && !s.isAiSuggested);
  $: suggestedSlots = slots.filter(s => s.isAiSuggested && !s.isConfirmed);

  $: totalPlannedMinutes = confirmedSlots.reduce((sum, s) => {
    return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000;
  }, 0);

  $: weeklyGoalMinutes = settings ? settings.dailyGoalHours * 7 * 60 : 0;
  $: plannedRatio = weeklyGoalMinutes > 0 ? Math.min(totalPlannedMinutes / weeklyGoalMinutes, 1) : 0;

  function minutesToLabel(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  }

  $: subjectStats = subjects.map(subject => {
    const mins = confirmedSlots
      .filter(s => s.subjectId === subject.id)
      .reduce((sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000, 0);
    return { subject, mins };
  }).filter(x => x.mins > 0).sort((a, b) => b.mins - a.mins);

  $: maxSubjectMins = Math.max(...subjectStats.map(x => x.mins), 1);

  $: todayStr = new Date().toISOString().split('T')[0];
  $: srsDueCount = srsCards.filter(c => c.dueDate <= weekEndStr && c.dueDate >= todayStr).length;

  $: srsBySubject = subjects.map(subject => ({
    subject,
    count: srsCards.filter(c => c.subjectId === subject.id && c.dueDate <= weekEndStr && c.dueDate >= todayStr).length,
  })).filter(x => x.count > 0);
</script>

<aside class="schedule-sidebar">
  <!-- This week -->
  <section class="sidebar-section">
    <div class="section-label">THIS WEEK</div>
    <div class="week-stat">
      <span class="stat-big">{minutesToLabel(totalPlannedMinutes)}</span>
      <span class="stat-goal">/ {settings ? `${settings.dailyGoalHours * 7}h` : '—'} goal</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {plannedRatio * 100}%;"></div>
    </div>
  </section>

  <!-- By subject -->
  {#if subjectStats.length > 0}
    <section class="sidebar-section">
      <div class="section-label">BY SUBJECT</div>
      {#each subjectStats as { subject, mins }}
        <div class="subject-row">
          <span class="subject-dot" style="background: {subject.color};"></span>
          <span class="subject-name">{subject.name}</span>
          <span class="subject-mins">{minutesToLabel(mins)}</span>
        </div>
        <div class="subject-bar-track">
          <div class="subject-bar-fill" style="width: {(mins / maxSubjectMins) * 100}%; background: {subject.color};"></div>
        </div>
      {/each}
    </section>
  {/if}

  <!-- SRS due -->
  {#if srsDueCount > 0}
    <section class="sidebar-section">
      <div class="section-label">SRS DUE THIS WEEK</div>
      <div class="srs-count">{srsDueCount} cards</div>
      {#each srsBySubject as { subject, count }}
        <div class="srs-row">
          <span class="subject-dot" style="background: {subject.color};"></span>
          <span class="subject-name">{subject.name}</span>
          <span class="srs-badge">{count}</span>
        </div>
      {/each}
    </section>
  {/if}

  <!-- AI suggestions -->
  {#if suggestedSlots.length > 0}
    <section class="sidebar-section">
      <div class="section-label">AI SUGGESTIONS</div>
      <div class="suggestion-count">{suggestedSlots.length} block{suggestedSlots.length !== 1 ? 's' : ''} pending</div>
      <div class="suggestion-actions">
        <button class="action-btn accept-all" on:click={() => dispatch('acceptAll')}>
          ✓ Accept all
        </button>
        <button class="action-btn reject-all" on:click={() => dispatch('rejectAll')}>
          ✕ Reject all
        </button>
      </div>
    </section>
  {/if}
</aside>

<style>
  .schedule-sidebar {
    width: 180px;
    flex-shrink: 0;
    border-left: 1px solid var(--border);
    background: var(--bg2);
    overflow-y: auto;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sidebar-section {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 8px;
  }

  /* This week */
  .week-stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 6px;
  }
  .stat-big {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
  }
  .stat-goal {
    font-size: 12px;
    color: var(--muted);
  }
  .progress-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--bg3);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  /* By subject */
  .subject-row {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
    margin-top: 6px;
  }
  .subject-row:first-of-type { margin-top: 0; }
  .subject-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .subject-name {
    flex: 1;
    font-size: 11px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subject-mins {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .subject-bar-track {
    height: 3px;
    border-radius: 2px;
    background: var(--bg3);
    overflow: hidden;
    margin-bottom: 2px;
  }
  .subject-bar-fill {
    height: 100%;
    border-radius: 2px;
    opacity: 0.75;
  }

  /* SRS */
  .srs-count {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 8px;
  }
  .srs-row {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 4px;
  }
  .srs-badge {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    background: var(--bg3);
    border-radius: 10px;
    padding: 0 6px;
    color: var(--text);
  }

  /* AI suggestions */
  .suggestion-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 10px;
  }
  .suggestion-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .action-btn {
    width: 100%;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    text-align: center;
  }
  .action-btn.accept-all {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }
  .action-btn.reject-all {
    background: var(--bg3);
    color: var(--muted);
  }
  .action-btn:hover { opacity: 0.85; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/calendar/ScheduleSidebar.svelte
git commit -m "feat(calendar): add ScheduleSidebar with weekly stats, SRS due, and AI accept/reject"
```

---

### Task 4: Exam Countdown Banner Component

**Files:**
- Create: `src/lib/components/calendar/ExamBanner.svelte`

Reads exam date from `localStorage.getItem('pulse_exam_date')`. Shown when exam is within 90 days. Hidden after exam date passes.

- [ ] **Step 1: Create `src/lib/components/calendar/ExamBanner.svelte`**

```svelte
<script lang="ts">
  import type { Subject, StudySession, Settings } from '$lib/types';
  import { onMount } from 'svelte';

  export let subjects: Subject[] = [];
  export let sessions: StudySession[] = [];
  export let settings: Settings | null = null;

  let examDate: string | null = null;
  let daysLeft = 0;
  let show = false;

  onMount(() => {
    examDate = localStorage.getItem('pulse_exam_date');
    if (!examDate) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(examDate);
    exam.setHours(0, 0, 0, 0);
    daysLeft = Math.round((exam.getTime() - today.getTime()) / 86400000);
    show = daysLeft >= 0 && daysLeft <= 90;
  });

  $: urgentColor = daysLeft <= 14 ? '#f59e0b' : 'var(--primary)';

  $: behindSubjects = (() => {
    if (!settings || subjects.length === 0) return [];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0] + 'T00:00:00';
    const weeklyGoalPer = (settings.dailyGoalHours * 7) / subjects.length;

    return subjects
      .map(subject => {
        const hours = sessions
          .filter(s => s.subjectId === subject.id && s.startedAt >= weekAgoStr)
          .reduce((sum, s) => sum + s.durationSec / 3600, 0);
        return { subject, deficit: weeklyGoalPer - hours };
      })
      .filter(x => x.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 2)
      .map(x => x.subject.name);
  })();
</script>

{#if show}
  <div class="exam-banner">
    <span class="pulse-dot" style="background: {urgentColor};"></span>
    <span class="banner-text">
      TCAS in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>
      {#if behindSubjects.length > 0}
        — <span class="behind">{behindSubjects.join(' & ')} {behindSubjects.length === 1 ? 'is' : 'are'} most behind this week</span>
      {/if}
    </span>
  </div>
{/if}

<style>
  .exam-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: color-mix(in srgb, var(--primary) 8%, var(--bg2));
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    color: var(--text);
    flex-shrink: 0;
  }
  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.85); }
  }
  .banner-text { color: var(--text); }
  .behind { color: var(--muted); }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/calendar/ExamBanner.svelte
git commit -m "feat(calendar): add exam countdown banner with behind-subject insight"
```

---

### Task 5: Wire Everything into the Schedule Page

**Files:**
- Modify: `src/routes/(app)/schedule/+page.svelte`

Add the Auto-schedule button, import and use the new components, wire `settings` prop, and handle `acceptAll`/`rejectAll` sidebar events.

- [ ] **Step 1: Update `src/routes/(app)/schedule/+page.svelte`**

Replace the file content with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, tasks, sessions, srsCards, scheduleSlots, loadData, loadScheduleSlots, getAuthContext } from '$lib/stores/data';
  import { settings } from '$lib/stores/settings';
  import { db } from '$lib/db';
  import { generateSchedule } from '$lib/scheduler';
  import WeekGrid from '$lib/components/calendar/WeekGrid.svelte';
  import MiniMonth from '$lib/components/calendar/MiniMonth.svelte';
  import ScheduleSidebar from '$lib/components/calendar/ScheduleSidebar.svelte';
  import ExamBanner from '$lib/components/calendar/ExamBanner.svelte';
  import type { ScheduleSlot } from '$lib/types';

  // ── Week navigation ───────────────────────────────────────────
  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  let viewedWeekStart = getWeekStart(new Date());

  $: weekEnd = (() => {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() + 7);
    return d;
  })();

  $: weekTitle = viewedWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevWeek() {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() - 7);
    viewedWeekStart = d;
  }

  function nextWeek() {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() + 7);
    viewedWeekStart = d;
  }

  function goToday() {
    viewedWeekStart = getWeekStart(new Date());
  }

  $: if ($auth.mode !== 'loading') {
    loadScheduleSlots(viewedWeekStart, weekEnd);
  }

  // ── Auto-schedule ─────────────────────────────────────────────
  let isScheduling = false;

  function handleAutoSchedule() {
    if (isScheduling) return;
    isScheduling = true;

    const { userId } = getAuthContext();
    const examDate = localStorage.getItem('pulse_exam_date');

    // Clear existing suggestions first
    scheduleSlots.update(all => all.filter(s => !s.isAiSuggested));

    const suggested = generateSchedule({
      weekStart: viewedWeekStart,
      subjects: $subjects,
      sessions: $sessions,
      srsCards: $srsCards,
      tasks: $tasks,
      existingSlots: $scheduleSlots,
      settings: $settings,
      examDate,
    });

    // Fill userId into suggestions
    const withUser = suggested.map(s => ({ ...s, userId }));
    scheduleSlots.update(all => [...all, ...withUser]);

    isScheduling = false;
  }

  // ── Event handlers ────────────────────────────────────────────
  async function handleCreateSlot(e: CustomEvent) {
    const { userId, mode } = getAuthContext();
    const { subjectId, topicId, startTime, endTime, isFocusBlock } = e.detail;
    const slot: ScheduleSlot = {
      id: db.newId(),
      userId,
      subjectId,
      topicId,
      startTime,
      endTime,
      isAiSuggested: false,
      isConfirmed: true,
      isFocusBlock: isFocusBlock ?? false,
      isRecurring: false,
      recurrenceDays: [],
      createdAt: new Date().toISOString(),
    };
    scheduleSlots.update(all => [...all, slot]);
    await db.saveScheduleSlot(slot, mode);
  }

  async function handleMoveSlot(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId, startTime, endTime } = e.detail;
    scheduleSlots.update(all => all.map(s => {
      if (s.id !== slotId) return s;
      const updated = { ...s, startTime, endTime };
      db.saveScheduleSlot(updated, mode);
      return updated;
    }));
  }

  async function handleResizeSlot(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId, startTime, endTime } = e.detail;
    scheduleSlots.update(all => all.map(s => {
      if (s.id !== slotId) return s;
      const updated = { ...s, startTime, endTime };
      db.saveScheduleSlot(updated, mode);
      return updated;
    }));
  }

  async function handleDeleteSlot(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId } = e.detail;
    await db.deleteScheduleSlot(slotId, mode);
    scheduleSlots.update(all => all.filter(s => s.id !== slotId));
  }

  async function handleAcceptSlot(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId } = e.detail;
    scheduleSlots.update(all => all.map(s => {
      if (s.id !== slotId) return s;
      const updated = { ...s, isConfirmed: true, isAiSuggested: false };
      db.saveScheduleSlot(updated, mode);
      return updated;
    }));
  }

  function handleDismissSlot(e: CustomEvent) {
    const { slotId } = e.detail;
    scheduleSlots.update(all => all.filter(s => s.id !== slotId));
  }

  function handleStartFocus(e: CustomEvent) {
    const { slot } = e.detail as { slot: ScheduleSlot };
    goto(`/timer?subjectId=${slot.subjectId}${slot.topicId ? `&topicId=${slot.topicId}` : ''}&mode=focus`);
  }

  async function handleChangeSubject(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId, subjectId } = e.detail as { slotId: string; subjectId: string | undefined };
    scheduleSlots.update(all => all.map(s => {
      if (s.id !== slotId) return s;
      const updated = { ...s, subjectId, topicId: undefined };
      db.saveScheduleSlot(updated, mode);
      return updated;
    }));
  }

  async function handleAcceptAll() {
    const { mode } = getAuthContext();
    const suggested = $scheduleSlots.filter(s => s.isAiSuggested && !s.isConfirmed);
    await db.confirmAllSuggested(suggested, mode);
    scheduleSlots.update(all => all.map(s =>
      s.isAiSuggested ? { ...s, isConfirmed: true, isAiSuggested: false } : s
    ));
  }

  function handleRejectAll() {
    scheduleSlots.update(all => all.filter(s => !s.isAiSuggested));
  }

  onMount(async () => {
    await loadData($auth);
    loadScheduleSlots(viewedWeekStart, weekEnd);
  });
</script>

<div class="schedule-wrap">
  <!-- Left panel -->
  <aside class="left-panel">
    <MiniMonth
      currentWeekStart={viewedWeekStart}
      sessions={$sessions}
      tasks={$tasks}
      subjects={$subjects}
      on:weekSelect={(e) => { viewedWeekStart = e.detail; }}
    />
  </aside>

  <!-- Main area -->
  <div class="main-area">
    <ExamBanner subjects={$subjects} sessions={$sessions} settings={$settings} />

    <header class="cal-header">
      <div class="week-nav">
        <button class="nav-btn" on:click={prevWeek} aria-label="Previous week">‹</button>
        <button class="nav-btn" on:click={nextWeek} aria-label="Next week">›</button>
        <span class="week-title">{weekTitle}</span>
        <button class="today-btn" on:click={goToday}>Today</button>
      </div>
      <div class="header-actions">
        <button
          class="auto-btn"
          class:loading={isScheduling}
          on:click={handleAutoSchedule}
          disabled={isScheduling}
        >
          {isScheduling ? 'Scheduling…' : '✦ Auto-schedule'}
        </button>
      </div>
    </header>

    <WeekGrid
      weekStart={viewedWeekStart}
      slots={$scheduleSlots}
      subjects={$subjects}
      topics={$topics}
      tasks={$tasks}
      settings={$settings}
      on:createSlot={handleCreateSlot}
      on:moveSlot={handleMoveSlot}
      on:resizeSlot={handleResizeSlot}
      on:deleteSlot={handleDeleteSlot}
      on:acceptSlot={handleAcceptSlot}
      on:dismissSlot={handleDismissSlot}
      on:startFocus={handleStartFocus}
      on:changeSubject={handleChangeSubject}
    />
  </div>

  <!-- Right sidebar -->
  <ScheduleSidebar
    slots={$scheduleSlots}
    subjects={$subjects}
    srsCards={$srsCards}
    sessions={$sessions}
    settings={$settings}
    weekStart={viewedWeekStart}
    on:acceptAll={handleAcceptAll}
    on:rejectAll={handleRejectAll}
  />
</div>

<style>
  .schedule-wrap {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
  }

  .left-panel {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    background: var(--bg2);
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg2);
  }

  .week-nav {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .week-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 4px;
    min-width: 140px;
  }

  .nav-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px 8px;
  }
  .nav-btn:hover { background: var(--bg3); }

  .today-btn {
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    margin-left: 4px;
  }
  .today-btn:hover { background: var(--bg3); }

  .header-actions { display: flex; align-items: center; gap: 8px; }

  .auto-btn {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1.5px solid var(--primary);
    background: var(--primary);
    color: white;
    cursor: pointer;
    letter-spacing: 0.01em;
  }
  .auto-btn:hover:not(:disabled) { opacity: 0.88; }
  .auto-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .auto-btn.loading { opacity: 0.7; }

  @media (max-width: 768px) {
    .left-panel { display: none; }
  }
</style>
```

Note: this imports `srsCards` from the data store — verify it's exported. If not, add `export const srsCards = writable<SrsCard[]>([]);` to `src/lib/stores/data.ts` and populate it in `loadData`.

- [ ] **Step 2: Verify `srsCards` is exported from `data.ts`**

Check `src/lib/stores/data.ts` — `srsCards` should already be exported from Phase 1. If not, add it.

- [ ] **Step 3: Verify**

Run: `npm run check`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/schedule/+page.svelte
git commit -m "feat(calendar): wire Auto-schedule, exam banner, and sidebar into schedule page"
```

---

### Task 6: Settings Page — Calendar & Scheduling Section

**Files:**
- Modify: `src/routes/(app)/settings/+page.svelte`

Add a "Calendar & Scheduling" section below the existing settings with:
- School hours toggle + day picker + start/end time
- Energy profile selector
- Buffer time slider

- [ ] **Step 1: Add calendar settings section**

In `src/routes/(app)/settings/+page.svelte`, find the end of the existing settings sections and add:

```svelte
<!-- Calendar & Scheduling -->
<section class="settings-section">
  <h2 class="section-title">Calendar & Scheduling</h2>

  <!-- School hours -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">School hours</span>
      <span class="setting-desc">Block these times from auto-scheduling</span>
    </div>
    <label class="toggle">
      <input type="checkbox" bind:checked={$settings.schoolHoursEnabled} on:change={save} />
      <span class="toggle-track"></span>
    </label>
  </div>

  {#if $settings.schoolHoursEnabled}
    <div class="school-hours-config">
      <div class="day-picker">
        {#each [['M',1],['T',2],['W',3],['T',4],['F',5],['S',6],['S',7]] as [label, val]}
          <button
            class="day-chip"
            class:active={$settings.schoolDays.includes(val)}
            on:click={() => {
              const days = $settings.schoolDays.includes(val)
                ? $settings.schoolDays.filter(d => d !== val)
                : [...$settings.schoolDays, val];
              settings.update(s => ({ ...s, schoolDays: days }));
              save();
            }}
          >{label}</button>
        {/each}
      </div>
      <div class="time-row">
        <label class="time-field">
          <span>From</span>
          <input type="time" bind:value={$settings.schoolStart} on:change={save} />
        </label>
        <label class="time-field">
          <span>To</span>
          <input type="time" bind:value={$settings.schoolEnd} on:change={save} />
        </label>
      </div>
    </div>
  {/if}

  <!-- Energy profile -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Energy profile</span>
      <span class="setting-desc">Auto-schedule matches hard subjects to your peak hours</span>
    </div>
  </div>
  <div class="energy-options">
    {#each [['morning','🌅 Morning person','Peak 6am–12pm'],['neutral','☀️ No preference','Equal weighting'],['evening','🌙 Evening person','Peak 6pm–10pm']] as [val, label, desc]}
      <button
        class="energy-chip"
        class:active={$settings.energyProfile === val}
        on:click={() => { settings.update(s => ({ ...s, energyProfile: val })); save(); }}
      >
        <span class="energy-label">{label}</span>
        <span class="energy-desc">{desc}</span>
      </button>
    {/each}
  </div>

  <!-- Buffer time -->
  <div class="setting-row">
    <div class="setting-info">
      <span class="setting-label">Buffer between sessions</span>
      <span class="setting-desc">{$settings.bufferMinutes} min gap after each auto-scheduled block</span>
    </div>
    <input
      type="range"
      min="0"
      max="30"
      step="5"
      bind:value={$settings.bufferMinutes}
      on:change={save}
      style="width: 100px;"
    />
  </div>
</section>
```

Add the corresponding CSS to the settings page `<style>` block:

```css
.school-hours-config {
  padding: 10px 0 6px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.day-picker {
  display: flex;
  gap: 4px;
}
.day-chip {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.day-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}
.time-row {
  display: flex;
  gap: 12px;
}
.time-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
}
.time-field input {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}
.energy-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 10px 0;
}
.energy-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.energy-chip.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--bg));
}
.energy-label { font-size: 13px; font-weight: 600; }
.energy-desc { font-size: 11px; color: var(--muted); margin-top: 1px; }
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No type errors. The settings page `save` function should already persist via `settings.ts`.

- [ ] **Step 3: Browser check**

Run: `npm run dev`

Open `/settings`. Verify:
- "Calendar & Scheduling" section renders
- School hours toggle shows/hides the day picker + time pickers
- Energy profile chips toggle correctly
- Buffer slider moves and updates the label

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/settings/+page.svelte
git commit -m "feat(calendar): add school hours, energy profile, and buffer settings UI"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Auto-schedule button in calendar header | Task 5 |
| Pure scheduler algorithm in `scheduler.ts` | Task 1 |
| Scheduler: blocked time from school hours + confirmed slots | Task 1 |
| Scheduler: subject scoring (SRS overdue, deficit, exam boost) | Task 1 |
| Scheduler: energy profile slot scoring | Task 1 |
| Scheduler: greedy fill with buffer | Task 1 |
| Scheduler: task deadline injection | Task 1 |
| Suggested slots returned as `isAiSuggested: true, isConfirmed: false` | Task 1 |
| Re-run clears previous suggestions before generating new ones | Task 5 |
| Load bars (4px per day, color by ratio vs goal) | Task 2 |
| Load bar tooltip "Xh planned · Yh goal" | Task 2 |
| School hours grey shaded region in grid | Task 2 |
| Right sidebar: planned hours / weekly goal + progress bar | Task 3 |
| Right sidebar: per-subject time bars | Task 3 |
| Right sidebar: SRS due count + by-subject breakdown | Task 3 |
| Right sidebar: pending suggestion count + Accept all / Reject all | Task 3 |
| Exam countdown banner with days left | Task 4 |
| Banner: pulsing dot, amber color ≤ 14 days | Task 4 |
| Banner: "most behind" subjects from weekly deficit | Task 4 |
| Accept all → `db.confirmAllSuggested` batch upsert | Task 5 |
| Reject all → removes suggestions from store (no DB write) | Task 5 |
| School hours settings UI (toggle + day picker + time) | Task 6 |
| Energy profile settings UI (3 options) | Task 6 |
| Buffer time slider 0–30 min | Task 6 |
