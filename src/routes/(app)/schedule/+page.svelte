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
      on:startFocus={handleStartFocus}
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
