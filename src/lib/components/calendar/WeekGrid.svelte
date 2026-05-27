<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import CalBlock from './CalBlock.svelte';
  import BlockPopover from './BlockPopover.svelte';
  import type { ScheduleSlot, Subject, Topic, Task } from '$lib/types';
  import type { Settings } from '$lib/stores/settings';

  export let weekStart: Date;
  export let slots: ScheduleSlot[] = [];
  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let tasks: Task[] = [];
  export let settings: Settings | null = null;

  const dispatch = createEventDispatcher<{
    createSlot: { subjectId?: string; topicId?: string; startTime: string; endTime: string; isFocusBlock: boolean };
    moveSlot: { slotId: string; startTime: string; endTime: string };
    resizeSlot: { slotId: string; startTime: string; endTime: string };
    deleteSlot: { slotId: string };
    acceptSlot: { slotId: string };
    dismissSlot: { slotId: string };
    startFocus: { slot: ScheduleSlot };
    changeSubject: { slotId: string; subjectId: string | undefined };
  }>();

  const HOUR_HEIGHT = 60; // 1px = 1 minute
  const START_HOUR = 0;  // midnight
  const END_HOUR = 24;   // next midnight
  const GAP_HOURS = 1;   // 12am–1am and 11pm–12am shown as dimmed gaps
  const TOTAL_HEIGHT = END_HOUR * HOUR_HEIGHT; // 1440px (full day)
  const HOURS = Array.from({ length: END_HOUR }, (_, i) => i); // 0..23

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
    nowTop = now.getHours() * 60 + now.getMinutes();
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
    if (ratio >= 1.0) return 'var(--danger)';
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

  function getSubject(id: string | undefined): Subject | undefined {
    return id ? subjects.find(s => s.id === id) : undefined;
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

  function getGridYFromClientY(clientY: number, dayIdx: number): number {
    const dayCol = document.querySelector(`.day-col[data-day="${dayIdx}"]`) as HTMLElement | null;
    if (!dayCol) return 0;
    const rect = dayCol.getBoundingClientRect();
    return clientY - rect.top;
  }

  function getGridY(e: MouseEvent, dayIdx: number): number {
    return getGridYFromClientY(e.clientY, dayIdx);
  }

  function onDayTouchstart(e: TouchEvent, dayIdx: number) {
    if (e.touches.length !== 2) return;
    if ((e.target as HTMLElement).closest('.cal-block')) return;
    e.preventDefault();
    const touch = e.touches[0];
    const gridY = getGridYFromClientY(touch.clientY, dayIdx);
    dragMode = 'create';
    dragDayIdx = dayIdx;
    dragStartAbsY = touch.clientY;
    dragStartGridY = gridY;
    ghostDayIdx = dayIdx;
    ghostTop = snap(gridY);
    ghostHeight = 15;
    ghostVisible = true;
    document.addEventListener('touchmove', onTouchmove, { passive: false });
    document.addEventListener('touchend', onTouchend);
  }

  function onTouchmove(e: TouchEvent) {
    if (!e.touches.length) return;
    e.preventDefault();
    const delta = e.touches[0].clientY - dragStartAbsY;
    if (dragMode === 'create') {
      const currentY = dragStartGridY + delta;
      ghostTop = snap(Math.max(0, Math.min(dragStartGridY, currentY)));
      ghostHeight = Math.max(15, snap(Math.abs(currentY - dragStartGridY)));
    }
  }

  function onTouchend(_e: TouchEvent) {
    document.removeEventListener('touchmove', onTouchmove);
    document.removeEventListener('touchend', onTouchend);
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
    }
    dragMode = 'none';
    dragSlot = null;
  }

  function onDayMousedown(e: MouseEvent, dayIdx: number) {
    if ((e.target as HTMLElement).closest('.cal-block')) return;
    if ((e.target as HTMLElement).closest('.block-popover-create')) return;
    if ((e.target as HTMLElement).closest('.popover-backdrop')) return;
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
    if (gridScrollEl) {
      gridScrollEl.scrollTop = Math.max(0, nowTop - 200);
    }
  });

  onDestroy(() => {
    clearInterval(nowInterval);
    document.removeEventListener('mousemove', onMousemove);
    document.removeEventListener('mouseup', onMouseup);
    document.removeEventListener('touchmove', onTouchmove);
    document.removeEventListener('touchend', onTouchend);
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

  <!-- Load bar row -->
  <div class="load-bar-row">
    <div class="time-gutter"></div>
    {#each weekDays as _day, i}
      <div class="load-bar-cell" title={loadBarTooltip(i)}>
        <div class="load-bar-fill" style="width: {loadBarWidth(i)}%; background: {loadBarColor(i)};"></div>
      </div>
    {/each}
  </div>

  <!-- All-day task pills (hidden when no tasks due this week) -->
  {#if [...tasksByDay.values()].some(arr => arr.length > 0)}
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
  {/if}

  <!-- Scrollable grid -->
  <div class="grid-scroll" bind:this={gridScrollEl}>
    <div class="grid-inner" style="height: {TOTAL_HEIGHT}px;">
      <!-- Hour labels -->
      <div class="time-col">
        {#each HOURS as hour}
          <div class="hour-label" style="top: {(hour - START_HOUR) * HOUR_HEIGHT}px;">{formatHour(hour)}</div>
        {/each}
        <div class="hour-label" style="top: {TOTAL_HEIGHT}px;">12am</div>
      </div>

      <!-- Day columns -->
      {#each weekDays as day, i}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          class="day-col"
          data-day={i}
          on:mousedown={(e) => onDayMousedown(e, i)}
          on:touchstart={(e) => onDayTouchstart(e, i)}
        >
          <!-- Midnight gap shading -->
          <div class="gap-shade" style="top: 0; height: {GAP_HOURS * HOUR_HEIGHT}px;"></div>
          <div class="gap-shade" style="top: {(END_HOUR - GAP_HOURS) * HOUR_HEIGHT}px; height: {GAP_HOURS * HOUR_HEIGHT}px;"></div>

          <!-- Hour lines -->
          {#each HOURS as hour}
            <div class="hour-line" style="top: {(hour - START_HOUR) * HOUR_HEIGHT}px;"></div>
          {/each}
          <!-- Half-hour lines -->
          {#each HOURS as hour}
            <div class="half-hour-line" style="top: {(hour - START_HOUR) * HOUR_HEIGHT + 30}px;"></div>
          {/each}

          <!-- School hours shading -->
          {#if schoolHoursBounds(i)}
            <div class="school-shade" style="top: {schoolHoursBounds(i)?.top}px; height: {schoolHoursBounds(i)?.height}px;"></div>
          {/if}

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
            {@const subject = slot.subjectId ? getSubject(slot.subjectId) : undefined}
            <div class="slot-wrap" style={slotStyle(slot)}>
              <CalBlock
                {slot}
                {subject}
                topic={getTopic(slot.topicId)}
                {subjects}
                on:dragStart={onBlockDragStart}
                on:resizeStart={onBlockResizeStart}
                on:delete={(e) => dispatch('deleteSlot', { slotId: e.detail.slotId })}
                on:accept={(e) => dispatch('acceptSlot', { slotId: e.detail.slotId })}
                on:dismiss={(e) => dispatch('dismissSlot', { slotId: e.detail.slotId })}
                on:startFocus={(e) => dispatch('startFocus', e.detail)}
                on:changeSubject={(e) => dispatch('changeSubject', e.detail)}
              />
            </div>
          {/each}

          <!-- BlockPopover for this day after drag-create -->
          {#if pendingBlock && pendingBlock.dayIdx === i}
            <!-- Ghost preview of the block being created -->
            <div class="ghost-block pending" style="top: {pendingBlock.top}px; height: {(new Date(pendingBlock.endTime).getTime() - new Date(pendingBlock.startTime).getTime()) / 60000}px;"></div>
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div style="position: absolute; top: {pendingBlock.top}px; left: 0; z-index: 160; width: 240px;" on:mousedown|stopPropagation on:click|stopPropagation>
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

  @media (max-width: 768px) {
    .week-grid-wrap { min-width: 560px; }
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
    color: var(--bg);
    font-weight: 700;
  }

  /* All-day row */
  .allday-row {
    display: grid;
    grid-template-columns: 44px repeat(7, 1fr);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    height: 24px;
    overflow: hidden;
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
    min-height: 0;
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

  /* Slot wrapper — absolutely positioned per slotStyle() */
  .slot-wrap {
    position: absolute;
    left: 3px;
    right: 3px;
    overflow: visible;
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

  /* Midnight gap shading */
  .gap-shade {
    position: absolute;
    left: 0;
    right: 0;
    background: var(--bg3);
    opacity: 0.6;
    pointer-events: none;
    z-index: 0;
  }

  /* School hours shading */
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
</style>
