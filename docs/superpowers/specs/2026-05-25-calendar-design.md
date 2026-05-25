# Smart Calendar Design Spec

**Date:** 2026-05-25
**Replaces:** `/schedule` stub (2-line placeholder)
**Inspired by:** Google Calendar (week grid, left panel), Rise Calendar (Ideal Week, energy scheduling, buffer time, focus blocks)

---

## Goal

Replace the stub Schedule page with a full smart study calendar. Students see their week as a time grid, drag to plan sessions, and hit Auto-schedule to let the app fill gaps based on SRS due dates, analytics weak spots, tasks with deadlines, school hours, and their energy profile. Suggested blocks appear ghosted — they accept or dismiss before anything is set.

---

## Implementation Phases

| Phase | Scope | Delivers |
|-------|-------|----------|
| 1 | Core calendar | Week grid, drag create/move/resize, mini month left panel, task pills, blocks persisted to DB |
| 2 | Smart scheduling | AI suggestions (ghosted), school hours, load bars, exam banner, weekly summary sidebar, accept/reject |
| 3 | Power features | Ideal Week template, energy scheduling, buffer time, focus blocks, recurring blocks, retroactive logging, subject filter chips |

Each phase ships independently. Phase 1 is a usable manual planner. Phase 2 adds the intelligence. Phase 3 adds Rise-style depth.

---

## Layout

```
┌─ App sidebar (existing) ─┬─ Left panel ──────┬─ Week grid ──────────────────────┬─ Right sidebar ─┐
│ nav items                │ Mini month        │ Exam banner (top)                │ Weekly stats    │
│                          │ Upcoming tasks    │ Header: title + nav + Auto btn   │ By-subject bars │
│                          │                   │ Subject filter chips             │ SRS due badge   │
│                          │                   │ Day headers + load bars          │ AI suggestions  │
│                          │                   │ All-day task pills row           │   accept/reject │
│                          │                   │ Hour rows 06:00–23:00            │                 │
└──────────────────────────┴───────────────────┴──────────────────────────────────┴─────────────────┘
```

**Left panel** (200px, collapsible on mobile): mini month at top, "Upcoming" task list below.

**Week grid** (flex: 1): time-label column (44px) + 7 day columns. Each hour = 60px tall. Scrollable vertically.

**Right sidebar** (180px, hidden on mobile): weekly hours, per-subject bars, SRS due count, AI suggestion accept/reject controls.

**Mobile (<768px):** Left panel hidden (accessible via swipe). Right sidebar hidden. Single-column day view with week strip at top for navigation.

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/routes/(app)/schedule/+page.svelte` | Layout shell, orchestrator, stores wiring |
| Create | `src/lib/components/calendar/WeekGrid.svelte` | 7-day hourly grid, drag interactions, block rendering |
| Create | `src/lib/components/calendar/CalBlock.svelte` | Single block — confirmed and suggested states |
| Create | `src/lib/components/calendar/MiniMonth.svelte` | Left panel mini month + upcoming list |
| Create | `src/lib/components/calendar/BlockPopover.svelte` | Subject/topic picker shown after drag-create |
| Create | `src/lib/scheduler.ts` | Pure auto-schedule algorithm — no Svelte, no side effects |
| Modify | `src/lib/types.ts` | Add `ScheduleSlot`, `IdealWeekSlot` |
| Modify | `src/lib/db.ts` | Add schedule slot CRUD methods |
| Modify | `src/lib/stores/data.ts` | Add `scheduleSlots` writable, load in `loadData` |
| Modify | `src/lib/stores/settings.ts` | Add school hours + energy profile fields |
| Modify | `src/routes/(app)/settings/+page.svelte` | Add school hours + energy profile UI |

---

## Types

```ts
// src/lib/types.ts additions

export interface ScheduleSlot {
  id: string;
  userId: string;
  subjectId: string;
  topicId?: string;
  startTime: string;          // ISO datetime: "2026-05-19T08:00:00"
  endTime: string;            // ISO datetime: "2026-05-19T09:30:00"
  isAiSuggested: boolean;     // true = ghosted dashed rendering
  isConfirmed: boolean;       // false = not yet accepted by user
  isFocusBlock: boolean;      // launches full-screen timer on start
  isRecurring: boolean;
  recurrenceDays: number[];   // [1,3,5] = Mon/Wed/Fri (0=Sun)
  recurrenceEndDate?: string; // ISO date — recurring stops here
  createdAt: string;
}

export interface IdealWeekSlot {
  id: string;
  userId: string;
  subjectId: string;
  dayOfWeek: number;          // 0=Sun … 6=Sat
  startHour: number;          // 8
  startMinute: number;        // 0
  durationMinutes: number;    // 60
}
```

Settings additions (added to existing `Settings` type):
```ts
schoolHoursEnabled: boolean;     // default false
schoolDays: number[];            // default [1,2,3,4,5]
schoolStart: string;             // default "08:00"
schoolEnd: string;               // default "15:30"
energyProfile: 'morning' | 'evening' | 'neutral'; // default 'neutral'
bufferMinutes: number;           // default 10
```

---

## Supabase Migration

```sql
create table if not exists schedule_slots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  subject_id      uuid not null references subjects(id) on delete cascade,
  topic_id        uuid references topics(id) on delete set null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  is_ai_suggested boolean not null default false,
  is_confirmed    boolean not null default true,
  is_focus_block  boolean not null default false,
  is_recurring    boolean not null default false,
  recurrence_days integer[] not null default '{}',
  recurrence_end  date,
  created_at      timestamptz not null default now()
);
alter table schedule_slots enable row level security;
create policy "users own schedule_slots" on schedule_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists ideal_week_slots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  subject_id       uuid not null references subjects(id) on delete cascade,
  day_of_week      smallint not null check (day_of_week between 0 and 6),
  start_hour       smallint not null,
  start_minute     smallint not null default 0,
  duration_minutes smallint not null,
  created_at       timestamptz not null default now()
);
alter table ideal_week_slots enable row level security;
create policy "users own ideal_week_slots" on ideal_week_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Guest mode: `schedule_slots` → `pulse_schedule_slots` in localStorage. `ideal_week_slots` → `pulse_ideal_week_slots`.

**Week-scoped loading:** `getScheduleSlots` accepts `weekStart` and `weekEnd` date strings and returns only slots within that window. The schedule page tracks `viewedWeekStart` as local state; navigating weeks triggers a re-fetch. For guest mode, all slots are fetched from localStorage and filtered client-side.

---

## Week Grid Rendering

**Grid structure:**
- CSS grid: `grid-template-columns: 44px repeat(7, 1fr)`
- Each hour row: `height: 60px` — 1px = 1 minute
- Hours shown: 06:00–23:00 (17 rows = 1020px total scrollable height)
- Scroll to current hour on mount

**Block positioning (absolute within day column — native Date, no date-fns):**
```ts
function slotToStyle(slot: ScheduleSlot, weekStart: Date): string {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  const top = startMinutes - 360; // 06:00 = 360 min offset, 1px per minute
  const height = Math.max(durationMinutes, 15); // min 15px visible
  return `top: ${top}px; height: ${height}px;`;
}

function slotDayIndex(slot: ScheduleSlot, weekStart: Date): number {
  const start = new Date(slot.startTime);
  start.setHours(0, 0, 0, 0);
  const base = new Date(weekStart);
  base.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - base.getTime()) / 86400000); // 0–6
}
```

No date library required — project uses native Date throughout.

**Current time indicator:**
- Red horizontal line at current minute position in today's column
- Updates every 60 seconds via `setInterval`
- Red dot (7px) at left edge of the line

---

## Block Visual States

```
Confirmed block:
  background: subject color (e.g. #0d9488 for Physics)
  border-radius: var(--radius-md)
  color: white
  resize handle: 5px strip at bottom edge (cursor: s-resize)

AI suggested block:
  background: subject color at 15% opacity
  border: 1.5px dashed subject color
  color: subject color (lighter tint)
  label prefix: "✦ "

Focus block (confirmed):
  left border: 3px solid white
  small ⚡ icon top-right
```

Clicking a confirmed block opens an inline popover: subject name, time, duration, "Start focus" button (if `isFocusBlock`), edit, delete.

Clicking a suggested block shows: accept ✓ button, dismiss ✕ button, reason text ("Chemistry is 3 days overdue").

---

## Drag Interactions

**Create (drag on empty cell):**
1. `mousedown` on empty time cell → record `dragStartSlot` (day + minute)
2. `mousemove` → draw a ghost block spanning from start to current position (min 15 min)
3. `mouseup` → if duration ≥ 15 min, open `BlockPopover` anchored to the ghost block
4. `BlockPopover` has: subject picker (color-coded list), optional topic, focus toggle → Save → creates `ScheduleSlot` with `isConfirmed: true`
5. If user presses Escape or clicks away → cancel, no block created

**Move (drag existing block):**
1. `mousedown` on block body → enter move mode, show ghost at original position
2. `mousemove` → move ghost block, snap to 15-minute increments
3. `mouseup` → update `startTime`/`endTime`, save to DB

**Resize (drag bottom handle):**
1. `mousedown` on `.block-resize` strip → enter resize mode
2. `mousemove` → extend/shrink `endTime`, snap to 15-minute increments, min 15 min
3. `mouseup` → save updated `endTime` to DB

All drag interactions use document-level mouse listeners (not element-level) to prevent losing the drag on fast cursor movement.

---

## Mini Month (Left Panel)

```
┌─────────────────────┐
│  ‹  May 2026  ›     │
│  M  T  W  T  F  S  S│
│        1  2  3  4   │
│  5  6  7  8  9 10 11│
│ 12 13 14 15 16 17 18│
│[19 20 21 22 23]24 25│  ← active week highlighted
│ 26 27 28 29 30 31   │
│  ● ● ●  ← study dots│
├─────────────────────┤
│ UPCOMING            │
│ Mock exam · Tue     │
│ TGAT practice · Thu │
└─────────────────────┘
```

- Current week: soft primary-tinted row highlight
- Today: solid primary circle on the date number
- Days with study sessions: 3 subject-color dots below the grid (up to 3, then "+N")
- Clicking any date navigates the week grid to the week containing that date
- "‹ / ›" changes month displayed in the mini month only — week grid stays until a date is clicked

---

## Load Bars

Row between day headers and task pills. Each day column shows a 4px bar:

```ts
const plannedMinutes = slotsThisDay.reduce((sum, s) => sum + duration(s), 0);
const goalMinutes = settings.dailyGoalHours * 60;
const ratio = Math.min(plannedMinutes / goalMinutes, 1.2); // cap at 120%

// Color:
// ratio < 0.5 → var(--border) (empty)
// 0.5–1.0    → var(--primary) (on track)
// > 1.0      → #ef4444 (overloaded)
```

Tooltip on hover: "3h 20m planned · 4h goal"

---

## Exam Countdown Banner

Shown when `localStorage.getItem('pulse_exam_date')` is set and the exam is within 90 days.

```
● TCAS in 47 days — Chemistry & Biology are most behind this week
```

- Pulsing dot: `var(--primary)` normally, `#f59e0b` when ≤ 14 days
- "most behind" = subjects with largest hours deficit vs. weekly goal
- Hidden when exam date has passed

---

## Weekly Summary Sidebar

Collapsible. Sections:

1. **This week** — planned hours / weekly goal, progress bar
2. **By subject** — each subject: color dot + name + mini bar (planned hours proportion)
3. **SRS due** — count of SRS cards due this week, broken down by subject
4. **AI suggestions** — count of pending ghosted blocks, "Accept all" + "Reject all" buttons

On mobile (< 768px): sidebar hidden, key stats collapse into a dismissible banner below the filter chips.

---

## Auto-Schedule Algorithm (`src/lib/scheduler.ts`)

Pure function signature:
```ts
function generateSchedule(input: SchedulerInput): ScheduleSlot[]

interface SchedulerInput {
  weekStart: Date;              // Monday of the week being scheduled
  subjects: Subject[];
  sessions: StudySession[];     // past 14 days
  srsCards: SrsCard[];
  tasks: Task[];
  existingSlots: ScheduleSlot[]; // confirmed blocks already on calendar
  settings: Settings;           // includes school hours, energy profile, buffer
  examDate: string | null;
}
```

**Step 1 — Build blocked time map**
For each day in the week:
- Mark school hours as blocked (if `schoolHoursEnabled`)
- Mark time occupied by existing confirmed slots as blocked

**Step 2 — Score subjects**
For each subject, compute a priority score:
```ts
score = srsOverdueCount * 3         // overdue SRS cards: highest urgency
      + srsDueThisWeekCount * 2     // due this week
      + hoursDeficit * 1.5          // (weeklyGoal/numSubjects) - actualHoursThisWeek
      + (targetScore / 100) * 1     // higher target = more priority
      + (daysToExam < 30 ? 2 : 0)  // exam urgency boost
```

**Step 3 — Score time slots**
For each available 30-min slot per day, compute energy match:
```ts
// morning profile: peak 06:00–12:00, valley 14:00–17:00
// evening profile: peak 18:00–22:00, valley 10:00–13:00
// neutral: all slots equal weight

energyScore(hour, profile) → 0.5–1.5 multiplier
subjectDifficulty(subject) → 'hard' | 'medium' | 'light'
// hard subjects (Physics, Math, Chem) prefer high-energy slots
// light subjects (English, Thai) prefer any slot
```

**Step 4 — Greedy fill**
Sort subjects by score descending. For each subject, find the best available slot (energy-matched), place a block of `min(90, hoursDeficit * 60)` minutes. Add `bufferMinutes` gap after each placed block. Move to next subject. Repeat until daily goal is reached or no slots remain.

**Step 5 — Task deadline injection**
For tasks with `dueDate` this week: inject a 45-min study block on the due date or the day before if due date is already full.

**Step 6 — Return**
Return `ScheduleSlot[]` with `isAiSuggested: true, isConfirmed: false`. These are written to the `scheduleSlots` store (not saved to DB until user accepts).

---

## Accept / Reject Flow

**Per block:** Click ghosted block → popover with "Accept ✓" and "Dismiss ✕". Accept: set `isConfirmed: true`, save to DB. Dismiss: remove from store.

**Accept all:** Button in right sidebar + "Accept all" confirmation. Calls `db.saveScheduleSlot` for every suggested slot in batch.

**Reject all:** Removes all suggested slots from store. No DB write.

**Re-run:** Hitting "Auto-schedule" again clears all existing suggested (unconfirmed) slots and runs the algorithm fresh.

---

## Ideal Week (Phase 3)

A separate "Ideal Week" mode (toggle in calendar header). Renders a template week — not real dates, just Mon–Sun. User drags to create `IdealWeekSlot` entries. Exiting Ideal Week mode returns to normal calendar.

On Sunday night (or on user request), the app materialises next week's `ScheduleSlot` records from `IdealWeekSlot` template — these are created as `isConfirmed: true` (not suggestions). User can delete/move them as normal.

---

## Focus Blocks

A block marked as focus (`isFocusBlock: true`) shows a small ⚡ icon. Clicking it → popover with "Start focus session" as the primary action. Tapping that button calls `goto('/timer')` with query params `?subjectId=...&topicId=...&mode=focus` — the timer page reads these and pre-fills + enters focus mode automatically.

---

## Recurring Blocks

When creating a block via `BlockPopover`, an optional "Repeat" toggle expands:
- Days of week checkboxes (M T W T F S S)
- End date picker (optional)

Saving a recurring block writes `isRecurring: true` + `recurrenceDays` + `recurrenceEndDate`. On the calendar, these materialise as individual `ScheduleSlot` records for each occurrence within the current view window (current week + 4 weeks forward). Editing one occurrence shows: "Edit this only" vs "Edit all future".

---

## Retroactive Session Logging

Clicking a past empty time slot (before current time) opens a simplified `BlockPopover` labelled "Log past session": subject, start/end time (pre-filled from clicked slot), optional topic. Saving creates both a `ScheduleSlot` (confirmed) and a `StudySession` record — feeding the session into Analytics automatically.

---

## Subject Filter Chips

Row of subject chips above the grid. Each chip shows the 2-char subject symbol in subject color. Active = tinted background. Tapping toggles. Inactive subjects' blocks are hidden from the grid (CSS `display: none` on filtered blocks). Filter state is local (not persisted).

---

## Settings Additions

New section in Settings page: **Calendar & Scheduling**

- **School hours** — toggle on/off. When on: day picker (M T W T F S S) + start time + end time. Displayed as a grey shaded region in the week grid.
- **Energy profile** — 3 options: Morning person / Evening person / No preference. Small description of what each does.
- **Buffer between sessions** — slider 0–30 min (default 10). AI adds this gap after every scheduled block.

---

## DB Methods (additions to `src/lib/db.ts`)

```ts
getScheduleSlots(userId, mode, weekStart, weekEnd): Promise<ScheduleSlot[]>
saveScheduleSlot(slot, mode): Promise<void>           // upsert
deleteScheduleSlot(slotId, mode): Promise<void>
confirmAllSuggested(slots, mode): Promise<void>       // batch upsert

getIdealWeekSlots(userId, mode): Promise<IdealWeekSlot[]>
saveIdealWeekSlot(slot, mode): Promise<void>
deleteIdealWeekSlot(slotId, mode): Promise<void>
```

Guest mode: localStorage keys `pulse_schedule_slots` and `pulse_ideal_week_slots`.

---

## Out of Scope

- Google Calendar / iCal sync
- Shared calendars (study groups)
- Push notifications for scheduled blocks
- Natural-language block creation ("add Physics tomorrow at 3pm")
- Offline queue for block edits (guest mode writes sync when online)
