<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, tasks, sessions, scheduleSlots, loadData, loadScheduleSlots, getAuthContext } from '$lib/stores/data';
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

  // ── Auto-schedule ─────────────────────────────────────────────
  let isScheduling = false;

  function handleAutoSchedule() {
    if (isScheduling) return;
    isScheduling = true;
    const { userId } = getAuthContext();
    const examDate = localStorage.getItem('pulse_exam_date');
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
    scheduleSlots.update(all => [...all, ...suggested]);
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

  async function handleChangeSubject(e: CustomEvent) {
    const { mode } = getAuthContext();
    const { slotId, subjectId } = e.detail as { slotId: string; subjectId: string | undefined };
    scheduleSlots.update(all => {
      return all.map(s => {
        if (s.id !== slotId) return s;
        const updated = { ...s, subjectId, topicId: undefined };
        db.saveScheduleSlot(updated, mode);
        return updated;
      });
    });
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
    <ExamBanner subjects={$subjects} sessions={$sessions} settings={$settings} />

    <header class="cal-header">
      <div class="week-nav">
        <button class="nav-btn icon-btn" on:click={prevWeek} aria-label="Previous week">‹</button>
        <button class="nav-btn icon-btn" on:click={nextWeek} aria-label="Next week">›</button>
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

  <ScheduleSidebar
    slots={$scheduleSlots}
    subjects={$subjects}
    topics={$topics}
    srsCards={$srsCards}
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
    min-height: 0;
  }

  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
