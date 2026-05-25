# Calendar Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub Schedule page with a working week-grid calendar — drag to create/move/resize study blocks, mini-month left panel, task pills row, all data persisted to Supabase or localStorage.

**Architecture:** `WeekGrid` handles rendering and drag interactions, dispatching events up to the schedule page, which owns all DB calls. `CalBlock` renders a single block in confirmed or suggested state. `BlockPopover` is shown after drag-create. `MiniMonth` lives in the left panel.

**Tech Stack:** SvelteKit 2, TypeScript, Supabase JS v2, plain CSS tokens, native JS Date (no date-fns)

---

### Task 1: Types & Settings

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/stores/settings.ts`

- [ ] **Step 1: Add `ScheduleSlot` and `IdealWeekSlot` to types.ts**

Append to the end of `src/lib/types.ts`:

```ts
export interface ScheduleSlot {
  id: string;
  userId: string;
  subjectId: string;
  topicId?: string;
  startTime: string;          // local ISO: "2026-05-19T08:00:00"
  endTime: string;            // local ISO: "2026-05-19T09:30:00"
  isAiSuggested: boolean;
  isConfirmed: boolean;
  isFocusBlock: boolean;
  isRecurring: boolean;
  recurrenceDays: number[];   // [1,3,5] = Mon/Wed/Fri
  recurrenceEndDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface IdealWeekSlot {
  id: string;
  userId: string;
  subjectId: string;
  dayOfWeek: number;       // 0=Sun … 6=Sat
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}
```

- [ ] **Step 2: Add calendar settings fields to settings.ts**

Replace the `Settings` interface in `src/lib/stores/settings.ts`:

```ts
export interface Settings {
  theme: Theme;
  lang: 'en' | 'th';
  dailyGoalHours: number;
  pomodoroWork: number;
  pomodoroBreak: number;
  schoolHoursEnabled: boolean;
  schoolDays: number[];        // [1,2,3,4,5] = Mon–Fri
  schoolStart: string;         // "08:00"
  schoolEnd: string;           // "15:30"
  energyProfile: 'morning' | 'evening' | 'neutral';
  bufferMinutes: number;
}
```

Replace the `defaults()` function:

```ts
function defaults(): Settings {
  return {
    theme: 'vercel-light',
    lang: 'en',
    dailyGoalHours: 4,
    pomodoroWork: 25,
    pomodoroBreak: 5,
    schoolHoursEnabled: false,
    schoolDays: [1, 2, 3, 4, 5],
    schoolStart: '08:00',
    schoolEnd: '15:30',
    energyProfile: 'neutral',
    bufferMinutes: 10,
  };
}
```

- [ ] **Step 3: Verify types compile**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/stores/settings.ts
git commit -m "feat(calendar): add ScheduleSlot, IdealWeekSlot types and calendar settings fields"
```

---

### Task 2: Supabase Migration

**Files:**
- Supabase: `schedule_slots` and `ideal_week_slots` tables

- [ ] **Step 1: Apply migration via Supabase MCP tool**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with project ID `bzcanpehaoeminjbzpvq` and the following SQL:

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

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "feat(calendar): create schedule_slots and ideal_week_slots tables in Supabase"
```

---

### Task 3: DB Methods

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add imports and mapper functions**

Add `ScheduleSlot, IdealWeekSlot` to the import at the top of `src/lib/db.ts`:

```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template, SubjectPreset, ScheduleSlot, IdealWeekSlot } from '$lib/types';
```

Add these mapper functions after `mapTemplateFromDb` (before `export const db`):

```ts
function mapScheduleSlotFromDb(row: Record<string, unknown>): ScheduleSlot {
  const startRaw = row.start_time as string;
  const endRaw = row.end_time as string;
  // Strip timezone suffix so we treat as local time
  const toLocal = (s: string) => s.replace(/\+.*$|Z$/, '').replace(' ', 'T').substring(0, 19);
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subjectId: row.subject_id as string,
    topicId: row.topic_id as string | undefined,
    startTime: toLocal(startRaw),
    endTime: toLocal(endRaw),
    isAiSuggested: row.is_ai_suggested as boolean,
    isConfirmed: row.is_confirmed as boolean,
    isFocusBlock: row.is_focus_block as boolean,
    isRecurring: row.is_recurring as boolean,
    recurrenceDays: (row.recurrence_days as number[]) ?? [],
    recurrenceEndDate: row.recurrence_end as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapIdealWeekSlotFromDb(row: Record<string, unknown>): IdealWeekSlot {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subjectId: row.subject_id as string,
    dayOfWeek: row.day_of_week as number,
    startHour: row.start_hour as number,
    startMinute: row.start_minute as number,
    durationMinutes: row.duration_minutes as number,
  };
}
```

- [ ] **Step 2: Add DB methods**

Add before `newId,` at the end of the `db` object (after `deleteSubject`):

```ts
  // ── SCHEDULE SLOTS ────────────────────────────────────────
  async getScheduleSlots(
    userId: string, mode: Mode,
    weekStart: string, weekEnd: string
  ): Promise<ScheduleSlot[]> {
    if (mode === 'guest') {
      const all = lsGet<ScheduleSlot>('pulse_schedule_slots');
      return all.filter(s => s.startTime >= weekStart && s.startTime < weekEnd);
    }
    const { data } = await supabase.from('schedule_slots').select('*')
      .eq('user_id', userId)
      .gte('start_time', weekStart)
      .lt('start_time', weekEnd)
      .order('start_time');
    return (data ?? []).map(mapScheduleSlotFromDb);
  },

  async saveScheduleSlot(slot: ScheduleSlot, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<ScheduleSlot>('pulse_schedule_slots');
      const idx = all.findIndex(s => s.id === slot.id);
      if (idx >= 0) all[idx] = slot; else all.push(slot);
      lsSet('pulse_schedule_slots', all);
      return;
    }
    await supabase.from('schedule_slots').upsert({
      id: slot.id,
      user_id: slot.userId,
      subject_id: slot.subjectId,
      topic_id: slot.topicId ?? null,
      start_time: slot.startTime,
      end_time: slot.endTime,
      is_ai_suggested: slot.isAiSuggested,
      is_confirmed: slot.isConfirmed,
      is_focus_block: slot.isFocusBlock,
      is_recurring: slot.isRecurring,
      recurrence_days: slot.recurrenceDays,
      recurrence_end: slot.recurrenceEndDate ?? null,
      created_at: slot.createdAt,
    });
  },

  async deleteScheduleSlot(slotId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_schedule_slots', lsGet<ScheduleSlot>('pulse_schedule_slots').filter(s => s.id !== slotId));
      return;
    }
    await supabase.from('schedule_slots').delete().eq('id', slotId);
  },

  async confirmAllSuggested(slots: ScheduleSlot[], mode: Mode): Promise<void> {
    const confirmed = slots.map(s => ({ ...s, isConfirmed: true, isAiSuggested: false }));
    await Promise.all(confirmed.map(s => db.saveScheduleSlot(s, mode)));
  },

  // ── IDEAL WEEK SLOTS ──────────────────────────────────────
  async getIdealWeekSlots(userId: string, mode: Mode): Promise<IdealWeekSlot[]> {
    if (mode === 'guest') return lsGet<IdealWeekSlot>('pulse_ideal_week_slots');
    const { data } = await supabase.from('ideal_week_slots').select('*').eq('user_id', userId);
    return (data ?? []).map(mapIdealWeekSlotFromDb);
  },

  async saveIdealWeekSlot(slot: IdealWeekSlot, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<IdealWeekSlot>('pulse_ideal_week_slots');
      const idx = all.findIndex(s => s.id === slot.id);
      if (idx >= 0) all[idx] = slot; else all.push(slot);
      lsSet('pulse_ideal_week_slots', all);
      return;
    }
    await supabase.from('ideal_week_slots').upsert({
      id: slot.id,
      user_id: slot.userId,
      subject_id: slot.subjectId,
      day_of_week: slot.dayOfWeek,
      start_hour: slot.startHour,
      start_minute: slot.startMinute,
      duration_minutes: slot.durationMinutes,
    });
  },

  async deleteIdealWeekSlot(slotId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_ideal_week_slots', lsGet<IdealWeekSlot>('pulse_ideal_week_slots').filter(s => s.id !== slotId));
      return;
    }
    await supabase.from('ideal_week_slots').delete().eq('id', slotId);
  },
```

- [ ] **Step 3: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(calendar): add schedule slot and ideal week slot DB methods"
```

---

### Task 4: Store Update

**Files:**
- Modify: `src/lib/stores/data.ts`

- [ ] **Step 1: Add scheduleSlots store and loadScheduleSlots**

Replace the entire `src/lib/stores/data.ts` with:

```ts
import { writable, derived } from 'svelte/store';
import { db } from '$lib/db';
import type { Subject, Topic, SrsCard, StudySession, Task, Template, ScheduleSlot } from '$lib/types';
import type { AuthState } from '$lib/stores/auth';

export const subjects = writable<Subject[]>([]);
export const topics = writable<Topic[]>([]);
export const srsCards = writable<SrsCard[]>([]);
export const sessions = writable<StudySession[]>([]);
export const tasks = writable<Task[]>([]);
export const templates = writable<Template[]>([]);
export const scheduleSlots = writable<ScheduleSlot[]>([]);

export const todaysSessions = derived(sessions, ($s) => {
  const today = new Date().toISOString().split('T')[0];
  return $s.filter(s => s.startedAt.startsWith(today));
});

export const dueCards = derived(srsCards, ($cards) => {
  const today = new Date().toISOString().split('T')[0];
  return $cards.filter(c => c.dueDate <= today);
});

export const todayHours = derived(todaysSessions, ($s) =>
  $s.reduce((sum, s) => sum + s.durationSec / 3600, 0)
);

export const streak = derived(sessions, ($s) => {
  if ($s.length === 0) return 0;
  const days = new Set($s.map(s => s.startedAt.split('T')[0]));
  let count = 0;
  const d = new Date();
  let base = d.toISOString().split('T')[0];
  if (!days.has(base)) {
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
    if (!days.has(base)) return 0;
  }
  while (days.has(base)) {
    count++;
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
  }
  return count;
});

export const tasksDueToday = derived(tasks, ($tasks) => {
  const today = new Date().toISOString().split('T')[0];
  return $tasks.filter(t => !t.completedAt && t.dueDate && t.dueDate <= today);
});

let _mode: 'guest' | 'authenticated' = 'guest';
let _userId = 'guest';

export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  _mode = authState.mode;
  _userId = authState.mode === 'guest' ? 'guest' : (authState.user?.id ?? '');

  const [s, t, c, sess, tsk, tmpl] = await Promise.all([
    db.getSubjects(_userId, _mode),
    db.getTopics(_userId, _mode),
    db.getSrsCards(_userId, _mode),
    db.getSessions(_userId, _mode),
    db.getTasks(_userId, _mode),
    db.getTemplates(_userId, _mode),
  ]);
  subjects.set(s);
  topics.set(t);
  srsCards.set(c);
  sessions.set(sess);
  tasks.set(tsk);
  templates.set(tmpl);
}

export async function loadScheduleSlots(weekStart: Date, weekEnd: Date): Promise<void> {
  const slots = await db.getScheduleSlots(
    _userId, _mode,
    weekStart.toISOString().substring(0, 19),
    weekEnd.toISOString().substring(0, 19)
  );
  scheduleSlots.set(slots);
}

export function getAuthContext(): { userId: string; mode: 'guest' | 'authenticated' } {
  return { userId: _userId, mode: _mode };
}
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/data.ts
git commit -m "feat(calendar): add scheduleSlots store and loadScheduleSlots"
```

---

### Task 5: CalBlock Component

**Files:**
- Create: `src/lib/components/calendar/CalBlock.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/calendar/CalBlock.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ScheduleSlot, Subject, Topic } from '$lib/types';

  export let slot: ScheduleSlot;
  export let subject: Subject;
  export let topic: Topic | undefined = undefined;

  const dispatch = createEventDispatcher<{
    accept: { slotId: string };
    dismiss: { slotId: string };
    delete: { slotId: string };
    startFocus: { slot: ScheduleSlot };
    dragStart: { slot: ScheduleSlot; event: MouseEvent };
    resizeStart: { slot: ScheduleSlot; event: MouseEvent };
  }>();

  let showPopover = false;

  $: isShort = (() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return (end.getTime() - start.getTime()) / 60000 < 30;
  })();

  $: timeLabel = (() => {
    const fmt = (s: string) => {
      const d = new Date(s);
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'pm' : 'am';
      return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
    };
    return `${fmt(slot.startTime)} – ${fmt(slot.endTime)}`;
  })();

  $: durationLabel = (() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const min = Math.round((end.getTime() - start.getTime()) / 60000);
    return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`;
  })();

  function onBlockClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.block-resize')) return;
    showPopover = !showPopover;
  }

  function onMousedown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.block-resize')) return;
    if (showPopover) return;
    dispatch('dragStart', { slot, event: e });
  }

  function onResizeMousedown(e: MouseEvent) {
    e.stopPropagation();
    dispatch('resizeStart', { slot, event: e });
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="cal-block"
  class:suggested={slot.isAiSuggested}
  class:focus-block={slot.isFocusBlock}
  style="background: {slot.isAiSuggested ? `rgba(${subject.colorRgb}, 0.15)` : subject.color};
         border: {slot.isAiSuggested ? `1.5px dashed ${subject.color}` : 'none'};
         color: {slot.isAiSuggested ? subject.color : 'white'};"
  on:click={onBlockClick}
  on:mousedown={onMousedown}
>
  {#if slot.isFocusBlock && !slot.isAiSuggested}
    <span class="focus-icon" aria-hidden="true">⚡</span>
  {/if}
  <div class="block-label">
    {#if slot.isAiSuggested}<span class="suggest-star">✦ </span>{/if}
    <strong>{subject.symbol}</strong>
    {#if !isShort && topic}<span class="block-topic"> · {topic.name}</span>{/if}
  </div>
  {#if !isShort}
    <div class="block-time">{timeLabel}</div>
  {/if}

  {#if !slot.isAiSuggested}
    <div class="block-resize" on:mousedown={onResizeMousedown} aria-hidden="true"></div>
  {/if}

  {#if showPopover}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="block-popover" on:click|stopPropagation>
      {#if slot.isAiSuggested}
        <div class="pop-title">Suggested · {subject.name}</div>
        <div class="pop-time">{timeLabel} · {durationLabel}</div>
        <div class="pop-actions">
          <button class="pop-btn accept" on:click={() => { showPopover = false; dispatch('accept', { slotId: slot.id }); }}>
            ✓ Accept
          </button>
          <button class="pop-btn dismiss" on:click={() => { showPopover = false; dispatch('dismiss', { slotId: slot.id }); }}>
            ✕ Dismiss
          </button>
        </div>
      {:else}
        <div class="pop-title">{subject.name}</div>
        {#if topic}<div class="pop-topic">{topic.name}</div>{/if}
        <div class="pop-time">{timeLabel} · {durationLabel}</div>
        <div class="pop-actions">
          {#if slot.isFocusBlock}
            <button class="pop-btn focus" on:click={() => { showPopover = false; dispatch('startFocus', { slot }); }}>
              ⚡ Start focus
            </button>
          {/if}
          <button class="pop-btn delete" on:click={() => { showPopover = false; dispatch('delete', { slotId: slot.id }); }}>
            Delete
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cal-block {
    position: absolute;
    left: 3px;
    right: 3px;
    border-radius: var(--radius-md);
    padding: 3px 6px;
    cursor: pointer;
    overflow: hidden;
    user-select: none;
    box-sizing: border-box;
    min-height: 15px;
  }
  .cal-block.focus-block {
    border-left: 3px solid rgba(255,255,255,0.8) !important;
  }
  .focus-icon {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 10px;
  }
  .block-label {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .suggest-star { opacity: 0.85; }
  .block-topic { font-weight: 400; opacity: 0.85; }
  .block-time {
    font-size: 10px;
    opacity: 0.8;
    margin-top: 1px;
    white-space: nowrap;
  }
  .block-resize {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 5px;
    cursor: s-resize;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
  .block-resize:hover { background: rgba(0,0,0,0.15); }

  .block-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 200;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    color: var(--text);
  }
  .pop-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
  .pop-topic { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  .pop-time { font-size: 11px; color: var(--muted); margin-bottom: 8px; }
  .pop-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .pop-btn {
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg3);
    color: var(--text);
    cursor: pointer;
  }
  .pop-btn.accept { background: var(--primary); color: white; border-color: var(--primary); }
  .pop-btn.focus { background: var(--primary); color: white; border-color: var(--primary); }
  .pop-btn.delete { color: #ef4444; border-color: #ef4444; }
  .pop-btn.dismiss { color: var(--muted); }
  .pop-btn:hover { opacity: 0.85; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/calendar/CalBlock.svelte
git commit -m "feat(calendar): add CalBlock component with confirmed and suggested states"
```

---

### Task 6: BlockPopover Component

**Files:**
- Create: `src/lib/components/calendar/BlockPopover.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/calendar/BlockPopover.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Subject, Topic } from '$lib/types';

  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let startTime: string = '';
  export let endTime: string = '';

  const dispatch = createEventDispatcher<{
    save: { subjectId: string; topicId: string | undefined; isFocusBlock: boolean };
    cancel: void;
  }>();

  let selectedSubjectId = subjects[0]?.id ?? '';
  let selectedTopicId = '';
  let isFocusBlock = false;

  $: filteredTopics = topics.filter(t => t.subjectId === selectedSubjectId);
  $: if (selectedSubjectId) selectedTopicId = '';

  $: timeLabel = (() => {
    const fmt = (s: string) => {
      const d = new Date(s);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const start = new Date(startTime);
    const end = new Date(endTime);
    const min = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${fmt(startTime)} – ${fmt(endTime)} (${min}m)`;
  })();

  function save() {
    if (!selectedSubjectId) return;
    dispatch('save', {
      subjectId: selectedSubjectId,
      topicId: selectedTopicId || undefined,
      isFocusBlock,
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('cancel');
    if (e.key === 'Enter') save();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="popover-backdrop" on:click={() => dispatch('cancel')}></div>

<div class="block-popover-create">
  <div class="pop-time-label">{timeLabel}</div>

  <div class="field-label">Subject</div>
  <div class="subject-list">
    {#each subjects as subject}
      <button
        class="subject-chip"
        class:active={selectedSubjectId === subject.id}
        style="--chip-color: {subject.color};"
        on:click={() => selectedSubjectId = subject.id}
      >
        <span class="chip-dot" style="background: {subject.color};"></span>
        {subject.name}
      </button>
    {/each}
  </div>

  {#if filteredTopics.length > 0}
    <div class="field-label" style="margin-top:10px;">Topic (optional)</div>
    <select class="topic-select" bind:value={selectedTopicId}>
      <option value="">— none —</option>
      {#each filteredTopics as t}
        <option value={t.id}>{t.name}</option>
      {/each}
    </select>
  {/if}

  <label class="focus-toggle">
    <input type="checkbox" bind:checked={isFocusBlock} />
    <span>⚡ Focus block</span>
  </label>

  <div class="pop-actions">
    <button class="pop-btn cancel" on:click={() => dispatch('cancel')}>Cancel</button>
    <button class="pop-btn save" disabled={!selectedSubjectId} on:click={save}>Add block</button>
  </div>
</div>

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 150;
  }
  .block-popover-create {
    position: absolute;
    z-index: 160;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    min-width: 220px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.18);
    color: var(--text);
  }
  .pop-time-label {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 10px;
    font-weight: 500;
  }
  .field-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .subject-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 2px;
  }
  .subject-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .subject-chip.active {
    border-color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 12%, transparent);
    color: var(--chip-color);
  }
  .chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .topic-select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
  }
  .focus-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    cursor: pointer;
  }
  .focus-toggle input { cursor: pointer; }
  .pop-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    justify-content: flex-end;
  }
  .pop-btn {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
  }
  .pop-btn.cancel { background: var(--bg3); color: var(--muted); }
  .pop-btn.save {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }
  .pop-btn.save:disabled { opacity: 0.4; cursor: not-allowed; }
  .pop-btn:not(:disabled):hover { opacity: 0.85; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/calendar/BlockPopover.svelte
git commit -m "feat(calendar): add BlockPopover component for drag-create subject picker"
```

---

### Task 7: MiniMonth Component

**Files:**
- Create: `src/lib/components/calendar/MiniMonth.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/calendar/MiniMonth.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { StudySession, Task, Subject } from '$lib/types';

  export let currentWeekStart: Date;
  export let sessions: StudySession[] = [];
  export let tasks: Task[] = [];
  export let subjects: Subject[] = [];

  const dispatch = createEventDispatcher<{ weekSelect: Date }>();

  let displayMonth = new Date(currentWeekStart);
  displayMonth.setDate(1);

  $: calendarDays = buildCalendar(displayMonth);
  $: upcomingTasks = getUpcomingTasks();

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function buildCalendar(monthStart: Date) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    // Offset: Monday-first. getDay() returns 0=Sun.
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function isToday(d: Date | null): boolean {
    if (!d) return false;
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function isInCurrentWeek(d: Date | null): boolean {
    if (!d) return false;
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= currentWeekStart && d < weekEnd;
  }

  function getDotsForDay(d: Date | null): string[] {
    if (!d) return [];
    const dateStr = d.toISOString().split('T')[0];
    const daySessions = sessions.filter(s => s.startedAt.startsWith(dateStr));
    const subjectIds = [...new Set(daySessions.map(s => s.subjectId))].slice(0, 3);
    return subjectIds.map(id => subjects.find(s => s.id === id)?.color ?? 'var(--muted)');
  }

  function onDayClick(d: Date | null) {
    if (!d) return;
    // Navigate week grid to the week containing this date
    const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    dispatch('weekSelect', weekStart);
  }

  function prevMonth() {
    displayMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1);
  }

  function nextMonth() {
    displayMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1);
  }

  $: monthLabel = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function getUpcomingTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inTwoWeeks = new Date(today);
    inTwoWeeks.setDate(today.getDate() + 14);
    return tasks
      .filter(t => !t.completedAt && t.dueDate)
      .filter(t => {
        const due = new Date(t.dueDate!);
        return due >= today && due <= inTwoWeeks;
      })
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 5);
  }

  function taskDayLabel(task: Task): string {
    if (!task.dueDate) return '';
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
</script>

<div class="mini-month">
  <div class="month-nav">
    <button class="nav-btn" on:click={prevMonth}>‹</button>
    <span class="month-label">{monthLabel}</span>
    <button class="nav-btn" on:click={nextMonth}>›</button>
  </div>

  <div class="day-headers">
    {#each DAY_LABELS as label}
      <div class="day-header">{label}</div>
    {/each}
  </div>

  <div class="day-grid">
    {#each calendarDays as day}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="day-cell"
        class:today={isToday(day)}
        class:in-week={isInCurrentWeek(day) && !isToday(day)}
        class:empty={!day}
        on:click={() => onDayClick(day)}
      >
        {#if day}
          <span class="day-num">{day.getDate()}</span>
          <div class="day-dots">
            {#each getDotsForDay(day) as color}
              <span class="dot" style="background: {color};"></span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if upcomingTasks.length > 0}
    <div class="upcoming-section">
      <div class="upcoming-label">UPCOMING</div>
      {#each upcomingTasks as task}
        <div class="upcoming-task">
          <span class="task-title">{task.title}</span>
          <span class="task-due">{taskDayLabel(task)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mini-month {
    padding: 12px;
    font-size: 12px;
    color: var(--text);
  }
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .month-label { font-size: 12px; font-weight: 600; }
  .nav-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 4px;
    line-height: 1;
  }
  .nav-btn:hover { color: var(--text); }
  .day-headers {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 2px;
  }
  .day-header {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    padding: 2px 0;
  }
  .day-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }
  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 0;
    border-radius: 4px;
    cursor: pointer;
    min-height: 26px;
  }
  .day-cell:not(.empty):hover { background: var(--bg3); }
  .day-cell.empty { cursor: default; }
  .day-cell.in-week { background: rgba(var(--primary-rgb), 0.08); }
  .day-cell.in-week:hover { background: rgba(var(--primary-rgb), 0.15); }
  .day-num {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    border-radius: 50%;
  }
  .day-cell.today .day-num {
    background: var(--primary);
    color: white;
    font-weight: 700;
  }
  .day-dots {
    display: flex;
    gap: 2px;
    margin-top: 1px;
    min-height: 4px;
  }
  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }
  .upcoming-section {
    margin-top: 14px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .upcoming-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .upcoming-task {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  .upcoming-task:last-child { border-bottom: none; }
  .task-title {
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .task-due { font-size: 10px; color: var(--muted); margin-top: 1px; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/calendar/MiniMonth.svelte
git commit -m "feat(calendar): add MiniMonth component with session dots and upcoming tasks"
```

---

### Task 8: WeekGrid Component

**Files:**
- Create: `src/lib/components/calendar/WeekGrid.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/calendar/WeekGrid.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import CalBlock from './CalBlock.svelte';
  import BlockPopover from './BlockPopover.svelte';
  import type { ScheduleSlot, Subject, Topic, Task } from '$lib/types';

  export let weekStart: Date;
  export let slots: ScheduleSlot[] = [];
  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let tasks: Task[] = [];

  const dispatch = createEventDispatcher<{
    createSlot: { subjectId: string; topicId?: string; startTime: string; endTime: string; isFocusBlock: boolean };
    moveSlot: { slotId: string; startTime: string; endTime: string };
    resizeSlot: { slotId: string; startTime: string; endTime: string };
    deleteSlot: { slotId: string };
    acceptSlot: { slotId: string };
    dismissSlot: { slotId: string };
  }>();

  const HOUR_HEIGHT = 60; // 1px = 1 minute
  const START_HOUR = 6;
  const END_HOUR = 23;
  const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT; // 1020px
  const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  $: weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // ── Current time ─────────────────────────────────────────────
  let nowTop = 0;
  let todayColIdx = -1;
  let nowInterval: ReturnType<typeof setInterval>;

  function updateNow() {
    const now = new Date();
    nowTop = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = new Date(weekStart);
    base.setHours(0, 0, 0, 0);
    const idx = Math.round((today.getTime() - base.getTime()) / 86400000);
    todayColIdx = idx >= 0 && idx < 7 ? idx : -1;
  }

  // ── Helpers ───────────────────────────────────────────────────
  function slotDayIdx(slot: ScheduleSlot): number {
    const start = new Date(slot.startTime);
    start.setHours(0, 0, 0, 0);
    const base = new Date(weekStart);
    base.setHours(0, 0, 0, 0);
    return Math.round((start.getTime() - base.getTime()) / 86400000);
  }

  function slotStyle(slot: ScheduleSlot): string {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const top = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    const height = Math.max((end.getTime() - start.getTime()) / 60000, 15);
    return `top: ${top}px; height: ${height}px;`;
  }

  $: slotsByDay = (() => {
    const map = new Map<number, ScheduleSlot[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const slot of slots) {
      const idx = slotDayIdx(slot);
      if (idx >= 0 && idx < 7) map.get(idx)!.push(slot);
    }
    return map;
  })();

  $: tasksByDay = (() => {
    const map = new Map<number, Task[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const task of tasks) {
      if (!task.dueDate || task.completedAt) continue;
      const due = new Date(task.dueDate + 'T00:00:00');
      const base = new Date(weekStart);
      base.setHours(0, 0, 0, 0);
      const idx = Math.round((due.getTime() - base.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) map.get(idx)!.push(task);
    }
    return map;
  })();

  function getSubject(id: string): Subject | undefined {
    return subjects.find(s => s.id === id);
  }

  function getTopic(id: string | undefined): Topic | undefined {
    return id ? topics.find(t => t.id === id) : undefined;
  }

  function isToday(d: Date): boolean {
    const t = new Date();
    return d.getFullYear() === t.getFullYear()
      && d.getMonth() === t.getMonth()
      && d.getDate() === t.getDate();
  }

  // ── Snap & time utils ─────────────────────────────────────────
  function snap(min: number): number {
    return Math.round(min / 15) * 15;
  }

  function toLocalISO(day: Date, totalMinutes: number): string {
    const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, totalMinutes));
    const d = new Date(day);
    d.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  // ── Drag state ────────────────────────────────────────────────
  type DragMode = 'none' | 'create' | 'move' | 'resize';
  let dragMode: DragMode = 'none';
  let dragDayIdx = 0;
  let dragStartAbsY = 0;
  let dragStartGridY = 0;   // Y within scrollable grid at mousedown (minutes from START_HOUR)
  let dragSlot: ScheduleSlot | null = null;
  let dragSlotOrigTop = 0;
  let dragSlotOrigHeight = 0;

  // Ghost overlay
  let ghostVisible = false;
  let ghostTop = 0;
  let ghostHeight = 0;
  let ghostDayIdx = 0;

  // Pending block shown after create-drag ends
  let pendingBlock: { startTime: string; endTime: string; dayIdx: number; top: number } | null = null;

  let gridScrollEl: HTMLElement | null = null;

  function getGridY(e: MouseEvent, dayIdx: number): number {
    const dayCol = document.querySelector(`.day-col[data-day="${dayIdx}"]`) as HTMLElement | null;
    if (!dayCol) return 0;
    const rect = dayCol.getBoundingClientRect();
    const scrollTop = gridScrollEl?.scrollTop ?? 0;
    return e.clientY - rect.top + scrollTop;
  }

  function onDayMousedown(e: MouseEvent, dayIdx: number) {
    if ((e.target as HTMLElement).closest('.cal-block')) return;
    e.preventDefault();
    const gridY = getGridY(e, dayIdx);
    dragMode = 'create';
    dragDayIdx = dayIdx;
    dragStartAbsY = e.clientY;
    dragStartGridY = gridY;
    ghostDayIdx = dayIdx;
    ghostTop = snap(gridY);
    ghostHeight = 15;
    ghostVisible = true;
    document.addEventListener('mousemove', onMousemove);
    document.addEventListener('mouseup', onMouseup);
  }

  function onBlockDragStart(e: CustomEvent<{ slot: ScheduleSlot; event: MouseEvent }>) {
    const { slot, event } = e.detail;
    event.preventDefault();
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const origTop = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    const origHeight = (end.getTime() - start.getTime()) / 60000;
    dragMode = 'move';
    dragSlot = slot;
    dragSlotOrigTop = origTop;
    dragSlotOrigHeight = origHeight;
    dragDayIdx = slotDayIdx(slot);
    dragStartAbsY = event.clientY;
    ghostDayIdx = dragDayIdx;
    ghostTop = origTop;
    ghostHeight = origHeight;
    ghostVisible = true;
    document.addEventListener('mousemove', onMousemove);
    document.addEventListener('mouseup', onMouseup);
  }

  function onBlockResizeStart(e: CustomEvent<{ slot: ScheduleSlot; event: MouseEvent }>) {
    const { slot, event } = e.detail;
    event.preventDefault();
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const origTop = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    const origHeight = (end.getTime() - start.getTime()) / 60000;
    dragMode = 'resize';
    dragSlot = slot;
    dragSlotOrigTop = origTop;
    dragSlotOrigHeight = origHeight;
    dragDayIdx = slotDayIdx(slot);
    dragStartAbsY = event.clientY;
    ghostDayIdx = dragDayIdx;
    ghostTop = origTop;
    ghostHeight = origHeight;
    ghostVisible = true;
    document.addEventListener('mousemove', onMousemove);
    document.addEventListener('mouseup', onMouseup);
  }

  function onMousemove(e: MouseEvent) {
    const delta = e.clientY - dragStartAbsY;
    if (dragMode === 'create') {
      const currentY = dragStartGridY + delta;
      ghostTop = snap(Math.max(0, Math.min(dragStartGridY, currentY)));
      ghostHeight = Math.max(15, snap(Math.abs(currentY - dragStartGridY)));
    } else if (dragMode === 'move') {
      ghostTop = Math.max(0, Math.min(TOTAL_HEIGHT - dragSlotOrigHeight, snap(dragSlotOrigTop + delta)));
    } else if (dragMode === 'resize') {
      ghostHeight = Math.max(15, snap(dragSlotOrigHeight + delta));
    }
  }

  function onMouseup(_e: MouseEvent) {
    document.removeEventListener('mousemove', onMousemove);
    document.removeEventListener('mouseup', onMouseup);
    ghostVisible = false;

    if (dragMode === 'create' && ghostHeight >= 15) {
      const day = weekDays[dragDayIdx];
      const startMin = ghostTop + START_HOUR * 60;
      const endMin = ghostTop + ghostHeight + START_HOUR * 60;
      pendingBlock = {
        startTime: toLocalISO(day, startMin),
        endTime: toLocalISO(day, endMin),
        dayIdx: dragDayIdx,
        top: ghostTop,
      };
    } else if (dragMode === 'move' && dragSlot) {
      const day = weekDays[ghostDayIdx];
      dispatch('moveSlot', {
        slotId: dragSlot.id,
        startTime: toLocalISO(day, ghostTop + START_HOUR * 60),
        endTime: toLocalISO(day, ghostTop + ghostHeight + START_HOUR * 60),
      });
    } else if (dragMode === 'resize' && dragSlot) {
      const start = new Date(dragSlot.startTime);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const day = weekDays[dragDayIdx];
      dispatch('resizeSlot', {
        slotId: dragSlot.id,
        startTime: dragSlot.startTime,
        endTime: toLocalISO(day, startMin + ghostHeight),
      });
    }

    dragMode = 'none';
    dragSlot = null;
  }

  // ── Popover handlers ──────────────────────────────────────────
  function onPopoverSave(e: CustomEvent) {
    if (!pendingBlock) return;
    const { subjectId, topicId, isFocusBlock } = e.detail;
    dispatch('createSlot', { subjectId, topicId, isFocusBlock, startTime: pendingBlock.startTime, endTime: pendingBlock.endTime });
    pendingBlock = null;
  }

  function onPopoverCancel() {
    pendingBlock = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  onMount(async () => {
    updateNow();
    nowInterval = setInterval(updateNow, 60000);
    await tick();
    if (gridScrollEl && nowTop > 0) {
      gridScrollEl.scrollTop = Math.max(0, nowTop - 120);
    }
  });

  onDestroy(() => {
    clearInterval(nowInterval);
    document.removeEventListener('mousemove', onMousemove);
    document.removeEventListener('mouseup', onMouseup);
  });

  function formatHour(h: number): string {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
  }

  function dayDateLabel(d: Date): string {
    return String(d.getDate());
  }

  function taskSubjectColor(task: Task): string {
    if (!task.subjectId) return 'var(--muted)';
    return getSubject(task.subjectId)?.color ?? 'var(--muted)';
  }
</script>

<div class="week-grid-wrap">
  <!-- Day headers -->
  <div class="grid-header">
    <div class="time-gutter"></div>
    {#each weekDays as day, i}
      <div class="day-header-cell" class:today={isToday(day)}>
        <span class="day-name">{DAY_SHORT[i]}</span>
        <span class="day-date" class:today-date={isToday(day)}>{dayDateLabel(day)}</span>
      </div>
    {/each}
  </div>

  <!-- All-day task pills -->
  <div class="allday-row">
    <div class="time-gutter"></div>
    {#each weekDays as _day, i}
      <div class="allday-cell">
        {#each tasksByDay.get(i) ?? [] as task}
          <div class="task-pill" style="background: {taskSubjectColor(task)}20; border-color: {taskSubjectColor(task)}; color: {taskSubjectColor(task)};">
            {task.title}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Scrollable grid -->
  <div class="grid-scroll" bind:this={gridScrollEl}>
    <div class="grid-inner" style="height: {TOTAL_HEIGHT}px;">
      <!-- Hour labels -->
      <div class="time-col">
        {#each HOURS as hour}
          <div class="hour-label" style="top: {(hour - START_HOUR) * HOUR_HEIGHT}px;">{formatHour(hour)}</div>
        {/each}
      </div>

      <!-- Day columns -->
      {#each weekDays as day, i}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          class="day-col"
          data-day={i}
          on:mousedown={(e) => onDayMousedown(e, i)}
        >
          <!-- Hour lines -->
          {#each HOURS as hour}
            <div class="hour-line" style="top: {(hour - START_HOUR) * HOUR_HEIGHT}px;"></div>
          {/each}
          <!-- Half-hour lines -->
          {#each HOURS as hour}
            <div class="half-hour-line" style="top: {(hour - START_HOUR) * HOUR_HEIGHT + 30}px;"></div>
          {/each}

          <!-- Current time indicator -->
          {#if i === todayColIdx && nowTop >= 0 && nowTop <= TOTAL_HEIGHT}
            <div class="now-line" style="top: {nowTop}px;">
              <div class="now-dot"></div>
            </div>
          {/if}

          <!-- Ghost block while dragging -->
          {#if ghostVisible && ghostDayIdx === i}
            <div class="ghost-block" style="top: {ghostTop}px; height: {ghostHeight}px;"></div>
          {/if}

          <!-- Actual blocks -->
          {#each slotsByDay.get(i) ?? [] as slot (slot.id)}
            {@const subject = getSubject(slot.subjectId)}
            {#if subject}
              <div style={slotStyle(slot)}>
                <CalBlock
                  {slot}
                  {subject}
                  topic={getTopic(slot.topicId)}
                  on:dragStart={onBlockDragStart}
                  on:resizeStart={onBlockResizeStart}
                  on:delete={(e) => dispatch('deleteSlot', { slotId: e.detail.slotId })}
                  on:accept={(e) => dispatch('acceptSlot', { slotId: e.detail.slotId })}
                  on:dismiss={(e) => dispatch('dismissSlot', { slotId: e.detail.slotId })}
                />
              </div>
            {/if}
          {/each}

          <!-- BlockPopover for this day after drag-create -->
          {#if pendingBlock && pendingBlock.dayIdx === i}
            <!-- Ghost preview of the block being created -->
            <div class="ghost-block pending" style="top: {pendingBlock.top}px; height: {(new Date(pendingBlock.endTime).getTime() - new Date(pendingBlock.startTime).getTime()) / 60000}px;"></div>
            <div style="position: absolute; top: {pendingBlock.top}px; left: 0; z-index: 160; width: 240px;">
              <BlockPopover
                {subjects}
                {topics}
                startTime={pendingBlock.startTime}
                endTime={pendingBlock.endTime}
                on:save={onPopoverSave}
                on:cancel={onPopoverCancel}
              />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .week-grid-wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* Header */
  .grid-header {
    display: grid;
    grid-template-columns: 44px repeat(7, 1fr);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .time-gutter { flex-shrink: 0; }
  .day-header-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    font-size: 12px;
    border-left: 1px solid var(--border);
  }
  .day-name { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .day-date {
    font-size: 18px;
    font-weight: 500;
    line-height: 1.3;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }
  .today-date {
    background: var(--primary);
    color: white;
    font-weight: 700;
  }

  /* All-day row */
  .allday-row {
    display: grid;
    grid-template-columns: 44px repeat(7, 1fr);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    min-height: 24px;
  }
  .allday-cell {
    border-left: 1px solid var(--border);
    padding: 2px 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .task-pill {
    font-size: 10px;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Scrollable grid */
  .grid-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }
  .grid-inner {
    display: grid;
    grid-template-columns: 44px repeat(7, 1fr);
    position: relative;
  }

  /* Time column */
  .time-col {
    position: relative;
    grid-column: 1;
    grid-row: 1;
  }
  .hour-label {
    position: absolute;
    right: 6px;
    font-size: 10px;
    color: var(--muted);
    transform: translateY(-50%);
    user-select: none;
    white-space: nowrap;
  }

  /* Day columns */
  .day-col {
    position: relative;
    border-left: 1px solid var(--border);
    cursor: crosshair;
    grid-row: 1;
  }
  .hour-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border);
    pointer-events: none;
  }
  .half-hour-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border);
    opacity: 0.4;
    pointer-events: none;
  }

  /* Current time */
  .now-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: #ef4444;
    pointer-events: none;
    z-index: 10;
  }
  .now-dot {
    position: absolute;
    left: -3px;
    top: -2.5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ef4444;
  }

  /* Ghost */
  .ghost-block {
    position: absolute;
    left: 3px;
    right: 3px;
    background: rgba(var(--primary-rgb), 0.25);
    border: 1.5px dashed var(--primary);
    border-radius: var(--radius-md);
    pointer-events: none;
    z-index: 5;
  }
  .ghost-block.pending { opacity: 0.5; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/calendar/WeekGrid.svelte
git commit -m "feat(calendar): add WeekGrid component with drag create/move/resize"
```

---

### Task 9: Schedule Page

**Files:**
- Modify: `src/routes/(app)/schedule/+page.svelte`

- [ ] **Step 1: Rewrite the schedule page**

Replace the entire `src/routes/(app)/schedule/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, tasks, sessions, scheduleSlots, loadScheduleSlots, getAuthContext } from '$lib/stores/data';
  import { db } from '$lib/db';
  import WeekGrid from '$lib/components/calendar/WeekGrid.svelte';
  import MiniMonth from '$lib/components/calendar/MiniMonth.svelte';
  import type { ScheduleSlot } from '$lib/types';

  // ── Week navigation ───────────────────────────────────────────
  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // to Monday
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

  // Reload slots whenever the week changes and auth is ready
  $: if ($auth.mode !== 'loading') {
    loadScheduleSlots(viewedWeekStart, weekEnd);
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
    scheduleSlots.update(all => {
      return all.map(s => {
        if (s.id !== slotId) return s;
        const updated = { ...s, startTime, endTime };
        db.saveScheduleSlot(updated, mode);
        return updated;
      });
    });
  }

  async function handleResizeSlot(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId, startTime, endTime } = e.detail;
    scheduleSlots.update(all => {
      return all.map(s => {
        if (s.id !== slotId) return s;
        const updated = { ...s, startTime, endTime };
        db.saveScheduleSlot(updated, mode);
        return updated;
      });
    });
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
    scheduleSlots.update(all => {
      return all.map(s => {
        if (s.id !== slotId) return s;
        const updated = { ...s, isConfirmed: true, isAiSuggested: false };
        db.saveScheduleSlot(updated, mode);
        return updated;
      });
    });
  }

  function handleDismissSlot(e: CustomEvent) {
    const { slotId } = e.detail;
    scheduleSlots.update(all => all.filter(s => s.id !== slotId));
  }

  function handleStartFocus(e: CustomEvent) {
    const { slot } = e.detail as { slot: ScheduleSlot };
    goto(`/timer?subjectId=${slot.subjectId}${slot.topicId ? `&topicId=${slot.topicId}` : ''}&mode=focus`);
  }

  onMount(() => {
    loadScheduleSlots(viewedWeekStart, weekEnd);
  });
</script>

<div class="schedule-wrap">
  <!-- Left panel: mini month + upcoming -->
  <aside class="left-panel">
    <MiniMonth
      currentWeekStart={viewedWeekStart}
      sessions={$sessions}
      tasks={$tasks}
      subjects={$subjects}
      on:weekSelect={(e) => { viewedWeekStart = e.detail; }}
    />
  </aside>

  <!-- Main calendar area -->
  <div class="main-area">
    <header class="cal-header">
      <div class="week-nav">
        <button class="nav-btn icon-btn" on:click={prevWeek} aria-label="Previous week">‹</button>
        <button class="nav-btn icon-btn" on:click={nextWeek} aria-label="Next week">›</button>
        <span class="week-title">{weekTitle}</span>
        <button class="today-btn" on:click={goToday}>Today</button>
      </div>
    </header>

    <WeekGrid
      weekStart={viewedWeekStart}
      slots={$scheduleSlots}
      subjects={$subjects}
      topics={$topics}
      tasks={$tasks}
      on:createSlot={handleCreateSlot}
      on:moveSlot={handleMoveSlot}
      on:resizeSlot={handleResizeSlot}
      on:deleteSlot={handleDeleteSlot}
      on:acceptSlot={handleAcceptSlot}
      on:dismissSlot={handleDismissSlot}
    />
  </div>
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
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 12px;
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

  @media (max-width: 768px) {
    .left-panel { display: none; }
  }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run check`

Expected: No errors.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Open `http://localhost:5173/schedule`. Verify:
- Left panel shows mini month with current week highlighted
- Week grid shows Mon–Sun with hour lines
- Drag on empty slot shows ghost block
- Releasing drag opens BlockPopover with subject chips
- Selecting a subject and clicking "Add block" creates a colored block on the grid
- Dragging an existing block moves it
- Dragging the resize handle at the bottom changes the block's duration
- Clicking a block opens an inline popover with delete option
- Navigating weeks (‹ ›) updates the grid

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/schedule/+page.svelte
git commit -m "feat(calendar): build Phase 1 calendar — week grid, drag create/move/resize, mini month"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Week grid 7-day × hourly, 1px=1min | Task 8 (WeekGrid) |
| Confirmed blocks: solid color, white text | Task 5 (CalBlock) |
| Suggested blocks: 15% opacity, dashed border, ✦ prefix | Task 5 (CalBlock) |
| Drag to create (≥15 min) → BlockPopover | Task 8 (WeekGrid) |
| Drag to move, snap 15 min | Task 8 (WeekGrid) |
| Drag to resize, snap 15 min | Task 8 (WeekGrid) |
| Document-level mouse listeners | Task 8 (WeekGrid) |
| Current time indicator, updates every 60s | Task 8 (WeekGrid) |
| Mini month left panel, week highlight, today circle | Task 7 (MiniMonth) |
| Study session dots per day | Task 7 (MiniMonth) |
| Upcoming tasks list below mini month | Task 7 (MiniMonth) |
| Task pills in all-day row | Task 8 (WeekGrid) |
| Block click popover: time, delete, start focus | Task 5 (CalBlock) |
| Suggested block popover: accept/dismiss | Task 5 (CalBlock) |
| Focus block ⚡ icon + start focus → /timer | Task 9 (Schedule page) |
| ScheduleSlot + IdealWeekSlot types | Task 1 |
| schedule_slots + ideal_week_slots Supabase tables | Task 2 |
| Guest mode: localStorage with week-scoped filter | Task 3 (DB) |
| scheduleSlots store, loadScheduleSlots | Task 4 (Store) |
| Week navigation prev/next/today | Task 9 (Schedule page) |
| Reload slots on week change | Task 9 (Schedule page) |
| Mobile: left panel hidden | Task 9 (Schedule page CSS) |
